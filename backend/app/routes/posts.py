from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app import models
from app.utils.dependencies import get_current_user, get_db
from pathlib import Path
from typing import List
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

# Upload posts
@router.post("/")
async def create_post(
    title: str = Form(...),
    description: str = Form(...),
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
