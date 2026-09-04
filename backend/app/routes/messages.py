from fastapi import APIRouter, Depends, HTTPException, Form, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session, joinedload
from app import models
from app.utils.dependencies import get_current_user, get_db, get_user_from_token

router = APIRouter()


# ═══ IN-MEMORY CONNECTION MANAGER (ek user ke multiple tabs bhi support karta hai) ═══
class ConnectionManager:
    def __init__(self):
        self.active: dict[int, list[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active.setdefault(user_id, []).append(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket):
        conns = self.active.get(user_id)
        if conns and websocket in conns:
            conns.remove(websocket)
        if conns is not None and not conns:
            self.active.pop(user_id, None)

    async def send_to_user(self, user_id: int, data: dict):
        for ws in list(self.active.get(user_id, [])):
            try:
                await ws.send_json(data)
            except Exception:
                pass


manager = ConnectionManager()


def _other_user(convo: models.Conversation, my_id: int) -> models.User:
    return convo.user_b if convo.user_a_id == my_id else convo.user_a


def _get_or_create_conversation(db: Session, user_a_id: int, user_b_id: int) -> models.Conversation:
    lo, hi = min(user_a_id, user_b_id), max(user_a_id, user_b_id)
    convo = db.query(models.Conversation).filter(
        models.Conversation.user_a_id == lo,
        models.Conversation.user_b_id == hi
    ).first()
    if not convo:
        convo = models.Conversation(user_a_id=lo, user_b_id=hi)
        db.add(convo)
        db.commit()
        db.refresh(convo)
    return convo


def _user_brief(u: models.User) -> dict:
    return {"id": u.u_id, "name": u.name, "avatar": u.user_image} if u else None


def _message_brief(m: models.Message) -> dict:
    return {
        "id": m.m_id,
        "conversation_id": m.conversation_id,
        "sender_id": m.sender_id,
        "content": m.content,
        "created_at": m.created_at.isoformat() if m.created_at else None
    }


# ═══ LIST MY CONVERSATIONS (Messages widget ka left panel) ═══
@router.get("/conversations")
def get_conversations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    convos = db.query(models.Conversation).filter(
        (models.Conversation.user_a_id == current_user.u_id) |
        (models.Conversation.user_b_id == current_user.u_id)
    ).order_by(models.Conversation.last_message_at.desc()).all()

    result = []
    for c in convos:
        other = _other_user(c, current_user.u_id)
        last_msg = db.query(models.Message).filter(
            models.Message.conversation_id == c.c_id
        ).order_by(models.Message.created_at.desc()).first()
        unread_count = db.query(models.Message).filter(
            models.Message.conversation_id == c.c_id,
            models.Message.sender_id != current_user.u_id,
            models.Message.is_read == 0
        ).count()

        result.append({
            "id": c.c_id,
            "other_user": _user_brief(other),
            "last_message": last_msg.content if last_msg else None,
            "last_message_at": last_msg.created_at.isoformat() if last_msg else c.created_at.isoformat(),
            "unread_count": unread_count
        })

    return {"conversations": result}


# ═══ GET OR CREATE CONVERSATION WITH A SPECIFIC USER (Accept flow yahi use karta hai) ═══
@router.get("/conversations/with/{user_id}")
def get_or_create_conversation_with(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if user_id == current_user.u_id:
        raise HTTPException(status_code=400, detail="Can't start a conversation with yourself")

    other = db.query(models.User).filter(models.User.u_id == user_id).first()
    if not other:
        raise HTTPException(status_code=404, detail="User not found")

    convo = _get_or_create_conversation(db, current_user.u_id, user_id)
    return {"id": convo.c_id, "other_user": _user_brief(other)}


# ═══ MESSAGE HISTORY (kholte hi dusre ke unread messages read mark ho jaate hain) ═══
@router.get("/conversations/{conversation_id}/messages")
def get_conversation_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    convo = db.query(models.Conversation).filter(models.Conversation.c_id == conversation_id).first()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if current_user.u_id not in (convo.user_a_id, convo.user_b_id):
        raise HTTPException(status_code=403, detail="Not part of this conversation")

    msgs = db.query(models.Message).filter(
        models.Message.conversation_id == conversation_id
    ).order_by(models.Message.created_at.asc()).all()

    # Dusre banda ke bheje hue unread messages ab read ho gaye (read-receipts nahi, sirf apna unread-count)
    db.query(models.Message).filter(
        models.Message.conversation_id == conversation_id,
        models.Message.sender_id != current_user.u_id,
        models.Message.is_read == 0
    ).update({"is_read": 1})
    db.commit()

    return {"messages": [_message_brief(m) for m in msgs]}


# ═══ SEND MESSAGE (yahi save karta hai — websocket sirf receive ke liye) ═══
@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: int,
    content: str = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    content = content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message can't be empty")

    convo = db.query(models.Conversation).filter(models.Conversation.c_id == conversation_id).first()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if current_user.u_id not in (convo.user_a_id, convo.user_b_id):
        raise HTTPException(status_code=403, detail="Not part of this conversation")

    new_msg = models.Message(
        conversation_id=conversation_id,
        sender_id=current_user.u_id,
        content=content
    )
    db.add(new_msg)

    convo.last_message_at = new_msg.created_at
    db.commit()
    db.refresh(new_msg)

    payload = _message_brief(new_msg)

    # Doosre user ko agar online hai to turant push kar do
    other_id = convo.user_b_id if convo.user_a_id == current_user.u_id else convo.user_a_id
    await manager.send_to_user(other_id, {"type": "new_message", "conversation_id": conversation_id, "message": payload})

    return {"message": payload}


# ═══ WEBSOCKET — sirf receive ke liye, token query param se aata hai (browser WS headers set nahi kar sakta) ═══
@router.websocket("/ws")
async def messages_websocket(websocket: WebSocket, token: str = Query(None), db: Session = Depends(get_db)):
    user = get_user_from_token(token, db) if token else None
    if not user:
        await websocket.close(code=4401)
        return

    await manager.connect(user.u_id, websocket)
    try:
        while True:
            await websocket.receive_text()  # client se kuch expect nahi karte, bas connection zinda rakhna hai
    except WebSocketDisconnect:
        manager.disconnect(user.u_id, websocket)