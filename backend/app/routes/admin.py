from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy import func, or_, extract
from sqlalchemy.exc import IntegrityError
from datetime import datetime
from sqlalchemy.orm import Session, joinedload
from typing import Literal

from app import models
from app.moderation import moderate_post, post_revision
from app.post_status import PENDING, APPROVED, REJECTED
from app.utils.dependencies import get_current_admin, get_db
from app.utils.security import hash_password, verify_password

router = APIRouter(dependencies=[Depends(get_current_admin)])


def overview(db):
    decisions = db.query(models.ModerationDecision).order_by(
        models.ModerationDecision.id.desc()).limit(10).all()
    return {
        "total_users": db.query(models.User).count(),
        "total_listings": db.query(models.Post).count(),
        "accepted_offers": db.query(models.Offer).filter(models.Offer.status == 2).count(),
        "pending_count": db.query(models.Post).filter(models.Post.status == PENDING).count(),
        "issue_count": db.query(models.PostModeration).join(
            models.Post, models.Post.p_id == models.PostModeration.post_id
        ).filter(models.Post.status == PENDING, models.PostModeration.label == "issue").count(),
        "unavailable_count": db.query(models.Post).outerjoin(
            models.PostModeration, models.Post.p_id == models.PostModeration.post_id
        ).filter(models.Post.status == PENDING,
                 (models.PostModeration.label == "unavailable") | (models.PostModeration.post_id.is_(None))).count(),
        "recent_activity": [{
            "post_title": d.post_title, "admin_name": d.admin_name,
            "decision": d.decision, "model_label": d.model_label,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        } for d in decisions],
    }


@router.get("/overview")
def get_overview(db: Session = Depends(get_db)):
    return overview(db)


@router.post("/refresh")
def refresh_overview(db: Session = Depends(get_db)):
    # Lock in ID order, matching edit/decision locks. Retry missing/failed checks.
    pending = db.query(models.Post).filter(models.Post.status == PENDING).order_by(
        models.Post.p_id).with_for_update().all()
    for post in pending:
        moderate_post(post, db)
    db.commit()
    return overview(db)


def review_payload(post, db):
    review = db.get(models.PostModeration, post.p_id)
    revision = post_revision(post, db)
    current = review and review.revision == revision
    return {
        "id": post.p_id, "title": post.title, "description": post.description,
        "in_exchange_for": post.in_exchange_for,
        "category": post.category.category if post.category else "General",
        "user": {"name": post.user.name if post.user else "Deleted user"},
        "images": [img.image_url for img in post.images if img.status == 1],
        "price_from": float(post.price_from), "price_to": float(post.price_to),
        "condition_score": post.condition_score,
        "created_at": post.created_at.isoformat() if post.created_at else None,
        "revision": revision, "status": {PENDING: "pending", APPROVED: "active", REJECTED: "rejected"}.get(post.status, "unknown"),
        "model_label": review.label if current else "unavailable",
        "confidence": float(review.confidence) if current and review.confidence is not None else None,
    }


@router.get("/pending")
def pending_posts(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    search: str = Query("", max_length=255), db: Session = Depends(get_db),
):
    query = db.query(models.Post).filter(models.Post.status == PENDING)
    if search.strip():
        pattern = f"%{search.strip()}%"
        query = query.filter(
            models.Post.title.ilike(pattern) | models.Post.description.ilike(pattern) |
            models.Post.user.has(models.User.name.ilike(pattern)) |
            models.Post.category.has(models.Category.category.ilike(pattern)))
    total = query.count()
    posts = query.options(joinedload(models.Post.user), joinedload(models.Post.category),
                          joinedload(models.Post.images)).order_by(models.Post.p_id).offset(
                              (page - 1) * page_size).limit(page_size).all()
    return {"posts": [review_payload(post, db) for post in posts],
            "total": total, "page": page, "page_size": page_size}


class ReviewDecision(BaseModel):
    decision: Literal["approve", "reject"]
    revision: str = Field(min_length=64, max_length=64, pattern=r"^[a-f0-9]+$")


@router.post("/posts/{post_id}/decision")
def decide_post(post_id: int, data: ReviewDecision, db: Session = Depends(get_db),
                admin: models.User = Depends(get_current_admin)):
    post = db.query(models.Post).filter(models.Post.p_id == post_id).with_for_update().first()
    if not post:
        raise HTTPException(status_code=404, detail="Post no longer exists")
    if post.status != PENDING:
        raise HTTPException(status_code=409, detail="This post has already been reviewed. Refresh the queue.")
    revision = post_revision(post, db)
    review = db.get(models.PostModeration, post_id)
    if revision != data.revision or not review or review.revision != revision:
        raise HTTPException(status_code=409, detail="This post changed. Refresh and review its latest details.")
    if review.label not in ("issue", "clean"):
        raise HTTPException(status_code=409, detail="Model check is unavailable. Refresh to retry before deciding.")
    post.status = APPROVED if data.decision == "approve" else REJECTED
    db.add(models.ModerationDecision(
        post_id=post_id, post_title=post.title, admin_id=admin.u_id, admin_name=admin.name,
        decision="approved" if data.decision == "approve" else "rejected",
        model_label=review.label, revision=revision,
    ))
    db.commit()
    return {"message": "Post approved and published" if post.status == APPROVED else "Post rejected",
            "post_id": post_id, "status": "active" if post.status == APPROVED else "rejected"}


# Sidebar sections share the same database-backed administrator authorization.
def paginated(query, page, page_size):
    total = query.count()
    return query.offset((page - 1) * page_size).limit(page_size).all(), total


def user_payload(user, db):
    return {
        'id': user.u_id, 'name': user.name, 'email': user.email,
        'contact': user.contact, 'role_id': user.role_id,
        'status': 'active' if user.status == 1 else 'suspended',
        'created_at': user.created_at.isoformat() if user.created_at else None,
        'listings': db.query(models.Post).filter(models.Post.user_id == user.u_id).count(),
        'accepted_exchanges': db.query(models.Offer).join(models.Post).filter(
            models.Offer.status == 2,
            or_(models.Post.user_id == user.u_id, models.Offer.offering_user_id == user.u_id)).count(),
    }


@router.get('/users')
def list_users(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
               search: str = Query('', max_length=255),
               status: Literal['all', 'active', 'suspended'] = 'all', db: Session = Depends(get_db)):
    query = db.query(models.User)
    if search.strip():
        pattern = f'%{search.strip()}%'
        query = query.filter(or_(models.User.name.ilike(pattern), models.User.email.ilike(pattern)))
    if status != 'all':
        query = query.filter(models.User.status == 1 if status == 'active' else models.User.status != 1)
    rows, total = paginated(query.order_by(models.User.u_id.desc()), page, page_size)
    return {'items': [user_payload(u, db) for u in rows], 'total': total, 'page': page, 'page_size': page_size}


class UserStatus(BaseModel):
    status: Literal['active', 'suspended']


@router.patch('/users/{user_id}/status')
def set_user_status(user_id: int, data: UserStatus, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.u_id == user_id).with_for_update().first()
    if not user:
        raise HTTPException(404, 'User no longer exists')
    if user.role_id == 2:
        raise HTTPException(409, 'Administrator accounts cannot be suspended here')
    user.status = 1 if data.status == 'active' else 0
    db.commit()
    return {'message': f'User {data.status}', 'user': user_payload(user, db)}


@router.get('/listings')
def list_listings(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                  search: str = Query('', max_length=255),
                  status: Literal['all', 'pending', 'active', 'rejected', 'issue'] = 'all',
                  db: Session = Depends(get_db)):
    query = db.query(models.Post)
    if status == 'issue':
        query = query.join(models.PostModeration).filter(
            models.Post.status == PENDING, models.PostModeration.label == 'issue')
    elif status != 'all':
        query = query.filter(models.Post.status == {'pending': PENDING, 'active': APPROVED, 'rejected': REJECTED}[status])
    if search.strip():
        pattern = f'%{search.strip()}%'
        query = query.filter(or_(models.Post.title.ilike(pattern), models.Post.description.ilike(pattern),
                                models.Post.user.has(models.User.name.ilike(pattern)),
                                models.Post.category.has(models.Category.category.ilike(pattern))))
    query = query.options(joinedload(models.Post.user), joinedload(models.Post.category), joinedload(models.Post.images))
    rows, total = paginated(query.order_by(models.Post.p_id.desc()), page, page_size)
    return {'items': [review_payload(p, db) for p in rows], 'total': total, 'page': page, 'page_size': page_size}


@router.get('/posts/{post_id}')
def get_listing(post_id: int, db: Session = Depends(get_db)):
    post = db.get(models.Post, post_id)
    if not post:
        raise HTTPException(404, 'Post no longer exists')
    return review_payload(post, db)


@router.get('/reports')
def list_reports(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                 search: str = Query('', max_length=255),
                 status: Literal['pending', 'resolved'] = 'pending', db: Session = Depends(get_db)):
    if status == 'pending':
        return list_listings(page, page_size, search, 'issue', db)
    query = db.query(models.ModerationDecision)
    if search.strip():
        pattern = f'%{search.strip()}%'
        query = query.filter(or_(models.ModerationDecision.post_title.ilike(pattern),
                                models.ModerationDecision.admin_name.ilike(pattern)))
    rows, total = paginated(query.order_by(models.ModerationDecision.id.desc()), page, page_size)
    return {'items': [{'id': r.id, 'post_id': r.post_id, 'title': r.post_title, 'admin_name': r.admin_name,
                       'decision': r.decision, 'model_label': r.model_label,
                       'created_at': r.created_at.isoformat() if r.created_at else None} for r in rows],
            'total': total, 'page': page, 'page_size': page_size}


def exchange_payload(offer):
    return {'id': offer.o_id, 'title': offer.title, 'description': offer.description,
            'listing': offer.post.title, 'owner': offer.post.user.name,
            'offered_by': offer.offering_user.name,
            'status': {0: 'rejected', 1: 'pending', 2: 'accepted'}.get(offer.status, 'unknown'),
            'created_at': offer.created_at.isoformat() if offer.created_at else None}


@router.get('/exchanges')
def list_exchanges(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                   search: str = Query('', max_length=255),
                   status: Literal['all', 'pending', 'accepted', 'rejected'] = 'all', db: Session = Depends(get_db)):
    query = db.query(models.Offer)
    if status != 'all':
        query = query.filter(models.Offer.status == {'pending': 1, 'accepted': 2, 'rejected': 0}[status])
    if search.strip():
        pattern = f'%{search.strip()}%'
        query = query.filter(or_(models.Offer.title.ilike(pattern),
            models.Offer.post.has(models.Post.title.ilike(pattern)),
            models.Offer.post.has(models.Post.user.has(models.User.name.ilike(pattern))),
            models.Offer.offering_user.has(models.User.name.ilike(pattern))))
    rows, total = paginated(query.options(joinedload(models.Offer.post).joinedload(models.Post.user),
                                          joinedload(models.Offer.offering_user)).order_by(models.Offer.o_id.desc()), page, page_size)
    return {'items': [exchange_payload(o) for o in rows], 'total': total, 'page': page, 'page_size': page_size}


@router.get('/analytics')
def analytics(db: Session = Depends(get_db)):
    now = datetime.now()
    month_start = datetime(now.year, now.month, 1)
    keys = [divmod(now.year * 12 + now.month - 1 - offset, 12) for offset in range(5, -1, -1)]
    start = datetime(keys[0][0], keys[0][1] + 1, 1)
    counts = db.query(extract('year', models.Offer.created_at), extract('month', models.Offer.created_at),
                      models.Offer.status, func.count(models.Offer.o_id)).filter(models.Offer.created_at >= start).group_by(
                          extract('year', models.Offer.created_at), extract('month', models.Offer.created_at), models.Offer.status).all()
    months = []
    for year, zero_month in keys:
        matching = [(status, count) for y, m, status, count in counts if int(y) == year and int(m) == zero_month + 1]
        months.append({'month': f'{year}-{zero_month + 1:02}', 'initiated': sum(c for _, c in matching),
                       'accepted': sum(c for s, c in matching if s == 2)})
    categories = db.query(models.Category.category, func.count(models.Post.p_id)).select_from(models.Post).outerjoin(
        models.Category, models.Post.category_id == models.Category.c_id).group_by(models.Category.category).order_by(func.count(models.Post.p_id).desc()).all()
    return {'total_users': db.query(models.User).count(),
            'new_users': db.query(models.User).filter(models.User.created_at >= month_start).count(),
            'total_listings': db.query(models.Post).count(),
            'accepted_exchanges': db.query(models.Offer).filter(models.Offer.status == 2).count(),
            'months': months, 'categories': [{'name': name or 'Uncategorized', 'count': count} for name, count in categories]}


class AdminProfile(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr = Field(max_length=100)
    current_password: str = Field(min_length=1, max_length=200)


@router.put('/profile')
def update_admin_profile(data: AdminProfile, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    if not verify_password(data.current_password, admin.password):
        raise HTTPException(400, 'Current password is incorrect')
    if not data.name.strip():
        raise HTTPException(400, 'Name cannot be blank')
    admin.name = data.name.strip()
    admin.email = str(data.email).lower()
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'Email is already in use')
    return {'message': 'Admin profile saved', 'name': admin.name, 'email': admin.email}


class AdminPassword(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=8, max_length=72)


@router.put('/password')
def update_admin_password(data: AdminPassword, db: Session = Depends(get_db), admin: models.User = Depends(get_current_admin)):
    if not verify_password(data.current_password, admin.password):
        raise HTTPException(400, 'Current password is incorrect')
    if len(data.new_password.encode('utf-8')) > 72:
        raise HTTPException(400, 'Password must not exceed 72 bytes')
    if not (any(c.isupper() for c in data.new_password) and any(c.islower() for c in data.new_password)
            and any(c.isdigit() for c in data.new_password) and any(not c.isalnum() for c in data.new_password)):
        raise HTTPException(400, 'Use uppercase, lowercase, a number, and a special character')
    admin.password = hash_password(data.new_password)
    db.commit()
    return {'message': 'Password changed successfully'}
