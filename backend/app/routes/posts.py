from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session, joinedload
from app import models, schemas
from app.utils.dependencies import get_current_user, get_db
from pathlib import Path
from typing import List, Optional
import os
import shutil
import uuid

router = APIRouter()

UPLOAD_ROOT = Path("uploads") / "posts"
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)


def _safe_filename(filename: str, index: int) -> str:
    original = Path(filename or "image.jpg").name.replace(" ", "_")
    suffix = Path(original).suffix or ".jpg"
    return f"{index + 1}_{uuid.uuid4().hex}{suffix}"


def _build_post_payload(post: models.Post, category_name: str, image_urls: list[str], owner: models.User) -> dict:
    created_at = post.created_at.isoformat() if post.created_at else None
    display_name = owner.name or "User"
    return {
        "id": post.p_id,
        "title": post.title,
        "cat": category_name,
        "category": category_name,
        "desc": post.description,
        "trade": post.in_exchange_for,
        "cond": post.condition_score,
        "condLabel": "Like New" if post.condition_score >= 9 else "Good" if post.condition_score >= 7 else "Fair" if post.condition_score >= 5 else "Poor",
        "value": float(post.price_from),
        "valueFrom": float(post.price_from),
        "valueTo": float(post.price_to),
        "images": image_urls,
        "status": "active",
        "date": created_at.split("T")[0] if created_at else None,
        "created_at": created_at,
        "seller": {
            "name": display_name,
            "avatar": owner.user_image
        },
        "ownerEmail": owner.email,
        "user_id": owner.u_id
    }


# ═══ GET MY POSTS (logged-in user) ═══
@router.get("/my")
def get_my_posts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    posts = db.query(models.Post).options(
        joinedload(models.Post.category),
        joinedload(models.Post.images)
    ).filter(
        models.Post.user_id == current_user.u_id,
        models.Post.status == 1
    ).order_by(models.Post.created_at.desc()).all()

    result = []
    for post in posts:
        image_urls = [img.image_url for img in post.images if img.status == 1]
        cat_name = post.category.category if post.category else "General"
        result.append(_build_post_payload(post, cat_name, image_urls, current_user))

    return {"posts": result, "total": len(result)}


# ═══ GET ALL POSTS ═══
@router.get("/")
def get_posts(
    category: Optional[str] = Query(None, description="Filter by category name"),
    search: Optional[str] = Query(None, description="Search in title or description"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(models.Post).options(
        joinedload(models.Post.user),
        joinedload(models.Post.category),
        joinedload(models.Post.images)
    ).filter(models.Post.status == 1)

    # Category filter
    if category and category.lower() != "all":
        query = query.join(models.Category).filter(
            models.Category.category.ilike(category)
        )

    # Search filter
    if search:
        query = query.filter(
            models.Post.title.ilike(f"%{search}%") |
            models.Post.description.ilike(f"%{search}%")
        )

    total = query.count()

    posts = query.order_by(models.Post.created_at.desc()) \
                 .offset((page - 1) * page_size) \
                 .limit(page_size) \
                 .all()

    result = []
    for post in posts:
        image_urls = [img.image_url for img in post.images if img.status == 1]
        cat_name = post.category.category if post.category else "General"
        result.append(_build_post_payload(post, cat_name, image_urls, post.user))

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "posts": result
    }


# ═══ GET SINGLE POST ═══
@router.get("/{post_id}")
def get_post(post_id: int, db: Session = Depends(get_db)):
    post = db.query(models.Post).options(
        joinedload(models.Post.user),
        joinedload(models.Post.category),
        joinedload(models.Post.images)
    ).filter(models.Post.p_id == post_id, models.Post.status == 1).first()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    image_urls = [img.image_url for img in post.images if img.status == 1]
    cat_name = post.category.category if post.category else "General"
    return _build_post_payload(post, cat_name, image_urls, post.user)


# ═══ UPDATE POST ═══
@router.put("/{post_id}")
async def update_post(
    post_id: int,
    title: str = Form(None),
    description: str = Form(None),
    in_exchange_for: str = Form(None),
    category: str = Form(None, max_length=100),
    price_from: float = Form(None),
    price_to: float = Form(None),
    condition_score: int = Form(None),
    images: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    post = db.query(models.Post).options(
        joinedload(models.Post.category),
        joinedload(models.Post.images)
    ).filter(models.Post.p_id == post_id).first()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.user_id != current_user.u_id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this post")

    # Update text fields
    if title:              post.title          = title.strip()
    if description:        post.description    = description.strip()
    if in_exchange_for is not None: post.in_exchange_for = in_exchange_for.strip()
    if price_from is not None:      post.price_from      = price_from
    if price_to   is not None:      post.price_to        = price_to
    if condition_score is not None: post.condition_score = condition_score

    if category:
        cat_name = category.strip()
        category_row = db.query(models.Category).filter(
            models.Category.category == cat_name,
            models.Category.status == 1
        ).first()
        if not category_row:
            category_row = models.Category(category=cat_name, status=1)
            db.add(category_row)
            db.flush()
        post.category_id = category_row.c_id

    # Replace images if new ones uploaded
    valid_images = [img for img in (images or []) if img and img.filename]
    new_image_urls: list[str] = []

    if valid_images:
        # Remove old image records and files
        db.query(models.ProductImage).filter(
            models.ProductImage.product_id == post_id
        ).delete()
        old_folder = UPLOAD_ROOT / f"user_{current_user.u_id}" / f"post_{post_id}"
        shutil.rmtree(old_folder, ignore_errors=True)

        user_folder = UPLOAD_ROOT / f"user_{current_user.u_id}" / f"post_{post_id}"
        user_folder.mkdir(parents=True, exist_ok=True)

        for index, image in enumerate(valid_images):
            file_name  = _safe_filename(image.filename, index)
            file_path  = user_folder / file_name
            contents   = await image.read()
            with open(file_path, "wb") as f:
                f.write(contents)
            image_url = f"/uploads/posts/user_{current_user.u_id}/post_{post_id}/{file_name}"
            new_image_urls.append(image_url)
            db.add(models.ProductImage(product_id=post_id, image_url=image_url, status=1))
    else:
        # Keep existing images
        new_image_urls = [img.image_url for img in post.images if img.status == 1]

    db.commit()
    db.refresh(post)

    cat_label = post.category.category if post.category else "General"
    return {
        "message": "Post updated",
        "post": _build_post_payload(post, cat_label, new_image_urls, current_user)
    }


# ═══ DELETE POST ═══
@router.delete("/{post_id}")
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    post = db.query(models.Post).filter(models.Post.p_id == post_id).first()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.user_id != current_user.u_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this post")

    # Remove uploaded image files from disk
    folder = UPLOAD_ROOT / f"user_{current_user.u_id}" / f"post_{post_id}"
    shutil.rmtree(folder, ignore_errors=True)

    db.delete(post)
    db.commit()
    return {"message": "Post deleted successfully"}


# ═══ CREATE POST ═══
@router.post("/")
async def create_post(
    title: str = Form(...),
    description: str = Form(..., max_length=100),
    in_exchange_for: str = Form(""),
    category: str = Form(...),
    price_from: float = Form(...),
    price_to: float = Form(...),
    condition_score: int = Form(...),
    images: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if price_from > price_to:
        raise HTTPException(status_code=400, detail="Invalid price range")

    category_name = category.strip()
    if not category_name:
        raise HTTPException(status_code=400, detail="Category is required")

    category_row = db.query(models.Category).filter(
        models.Category.category == category_name,
        models.Category.status == 1
    ).first()

    if not category_row:
        category_row = models.Category(category=category_name, status=1)
        db.add(category_row)
        db.flush()

    new_post = models.Post(
        title=title.strip(),
        description=description.strip(),
        in_exchange_for=in_exchange_for.strip(),
        category_id=category_row.c_id,
        price_from=price_from,
        price_to=price_to,
        condition_score=condition_score,
        user_id=current_user.u_id
    )

    db.add(new_post)
    db.flush()

    user_folder = UPLOAD_ROOT / f"user_{current_user.u_id}" / f"post_{new_post.p_id}"
    user_folder.mkdir(parents=True, exist_ok=True)

    image_urls: list[str] = []

    try:
        for index, image in enumerate(images or []):
            if not image or not image.filename:
                continue

            file_name = _safe_filename(image.filename, index)
            file_path = user_folder / file_name
            contents = await image.read()

            with open(file_path, "wb") as f:
                f.write(contents)

            image_url = f"/uploads/posts/user_{current_user.u_id}/post_{new_post.p_id}/{file_name}"
            image_urls.append(image_url)
            db.add(models.ProductImage(product_id=new_post.p_id, image_url=image_url, status=1))

        db.commit()
        db.refresh(new_post)

        return {
            "message": "Post created",
            "post": _build_post_payload(new_post, category_row.category, image_urls, current_user)
        }
    except Exception:
        db.rollback()
        shutil.rmtree(user_folder, ignore_errors=True)
        raise