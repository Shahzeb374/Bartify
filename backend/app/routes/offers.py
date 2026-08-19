from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session, joinedload
from app import models
from app.utils.dependencies import get_current_user, get_db
from pathlib import Path
from typing import List
import shutil
import uuid

router = APIRouter()

UPLOAD_ROOT = Path("uploads") / "offers"
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)


def _safe_filename(filename: str, index: int) -> str:
    original = Path(filename or "image.jpg").name.replace(" ", "_")
    suffix = Path(original).suffix or ".jpg"
    return f"{index + 1}_{uuid.uuid4().hex}{suffix}"


def _offer_status_label(status: int) -> str:
    if status == 2:
        return "accepted"
    if status == 0:
        return "rejected"
    return "pending"


# ═══ CREATE OFFER (post pr "Offer Exchange" click hone ke baad) ═══
@router.post("/")
async def create_offer(
    post_id: int = Form(...),
    title: str = Form(...),
    description: str = Form("", max_length=500),
    category: str = Form(...),
    price_from: float = Form(None),
    price_to: float = Form(None),
    condition_score: int = Form(None),
    images: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    target_post = db.query(models.Post).filter(models.Post.p_id == post_id).first()
    if not target_post:
        raise HTTPException(status_code=404, detail="Listing not found")
    if target_post.user_id == current_user.u_id:
        raise HTTPException(status_code=400, detail="You can't offer an exchange on your own listing")

    if price_from is not None and price_to is not None and price_from > price_to:
        raise HTTPException(status_code=400, detail="Invalid price range")

    category_name = category.strip()
    category_row = db.query(models.Category).filter(
        models.Category.category == category_name,
        models.Category.status == 1
    ).first()
    if not category_row:
        category_row = models.Category(category=category_name, status=1)
        db.add(category_row)
        db.flush()

    new_offer = models.Offer(
        post_id=post_id,
        offering_user_id=current_user.u_id,
        title=title.strip(),
        description=(description or "").strip(),
        category_id=category_row.c_id,
        price_from=price_from,
        price_to=price_to,
        condition_score=condition_score
    )
    db.add(new_offer)
    db.flush()

    offer_folder = UPLOAD_ROOT / f"user_{current_user.u_id}" / f"offer_{new_offer.o_id}"
    offer_folder.mkdir(parents=True, exist_ok=True)

    image_urls: list[str] = []

    try:
        for index, image in enumerate(images or []):
            if not image or not image.filename:
                continue

            file_name = _safe_filename(image.filename, index)
            file_path = offer_folder / file_name
            contents = await image.read()

            with open(file_path, "wb") as f:
                f.write(contents)

            image_url = f"/uploads/offers/user_{current_user.u_id}/offer_{new_offer.o_id}/{file_name}"
            image_urls.append(image_url)
            db.add(models.OfferImage(offer_id=new_offer.o_id, image_url=image_url, status=1))

        db.commit()
        db.refresh(new_offer)

        return {
            "message": "Offer sent successfully",
            "offer": {
                "id": new_offer.o_id,
                "post_id": post_id,
                "title": new_offer.title,
                "images": image_urls
            }
        }
    except Exception:
        db.rollback()
        shutil.rmtree(offer_folder, ignore_errors=True)
        raise


# ═══ GET OFFERS RECEIVED ON MY POSTS (future dashboard section ke liye ready) ═══
@router.get("/received")
def get_received_offers(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    offers = db.query(models.Offer).options(
        joinedload(models.Offer.post),
        joinedload(models.Offer.offering_user),
        joinedload(models.Offer.category),
        joinedload(models.Offer.images)
    ).join(models.Post, models.Offer.post_id == models.Post.p_id) \
     .filter(models.Post.user_id == current_user.u_id) \
     .order_by(models.Offer.created_at.desc()).all()

    result = []
    for o in offers:
        result.append({
            "id": o.o_id,
            "post_id": o.post_id,
            "post_title": o.post.title if o.post else None,
            "title": o.title,
            "description": o.description,
            "category": o.category.category if o.category else "General",
            "condition_score": o.condition_score,
            "price_from": float(o.price_from) if o.price_from is not None else None,
            "price_to": float(o.price_to) if o.price_to is not None else None,
            "images": [img.image_url for img in o.images if img.status == 1],
            "status": _offer_status_label(o.status),
            "offering_user": {
                "name": o.offering_user.name if o.offering_user else "User",
                "avatar": o.offering_user.user_image if o.offering_user else None
            },
            "created_at": o.created_at.isoformat() if o.created_at else None
        })

    return {"offers": result, "total": len(result)}


# ═══ GET OFFERS I'VE SENT (dusron ki posts pr) ═══
@router.get("/sent")
def get_sent_offers(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    offers = db.query(models.Offer).options(
        joinedload(models.Offer.post).joinedload(models.Post.images),
        joinedload(models.Offer.post).joinedload(models.Post.user),
        joinedload(models.Offer.category),
        joinedload(models.Offer.images)
    ).filter(models.Offer.offering_user_id == current_user.u_id) \
     .order_by(models.Offer.created_at.desc()).all()

    result = []
    for o in offers:
        target_post = o.post
        target_images = [img.image_url for img in target_post.images if img.status == 1] if target_post else []
        result.append({
            "id": o.o_id,
            "post_id": o.post_id,
            "post_title": target_post.title if target_post else None,
            "post_image": target_images[0] if target_images else None,
            "post_owner_name": target_post.user.name if target_post and target_post.user else None,
            "title": o.title,
            "description": o.description,
            "category": o.category.category if o.category else "General",
            "condition_score": o.condition_score,
            "price_from": float(o.price_from) if o.price_from is not None else None,
            "price_to": float(o.price_to) if o.price_to is not None else None,
            "images": [img.image_url for img in o.images if img.status == 1],
            "status": _offer_status_label(o.status),
            "created_at": o.created_at.isoformat() if o.created_at else None
        })

    return {"offers": result, "total": len(result)}


# ═══ ACCEPT OFFER (sirf target post ka owner) ═══
@router.put("/{offer_id}/accept")
def accept_offer(
    offer_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    offer = db.query(models.Offer).filter(models.Offer.o_id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    target_post = db.query(models.Post).filter(models.Post.p_id == offer.post_id).first()
    if not target_post or target_post.user_id != current_user.u_id:
        raise HTTPException(status_code=403, detail="Not authorized to act on this offer")

    offer.status = 2  # accepted
    db.commit()
    return {"message": "Offer accepted"}


# ═══ REJECT OFFER (sirf target post ka owner) ═══
@router.put("/{offer_id}/reject")
def reject_offer(
    offer_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    offer = db.query(models.Offer).filter(models.Offer.o_id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    target_post = db.query(models.Post).filter(models.Post.p_id == offer.post_id).first()
    if not target_post or target_post.user_id != current_user.u_id:
        raise HTTPException(status_code=403, detail="Not authorized to act on this offer")

    offer.status = 0  # rejected
    db.commit()
    return {"message": "Offer rejected"}