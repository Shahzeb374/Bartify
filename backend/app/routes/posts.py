from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app import models, schemas
from app.utils.dependencies import get_current_user, get_db

router = APIRouter()

# Upload posts
@router.post("/posts")
def create_post(
    post: schemas.PostCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    
    # Price validation
    if post.price_from > post.price_to:
        raise HTTPException(status_code=400, detail="Invalid price range")

    # Check category exists
    category = db.query(models.Category).filter(
        models.Category.c_id == post.category_id,
        models.Category.status == 1
    ).first()

    if not category:
        raise HTTPException(status_code=404, detail="Category not found or in active")

    # Create post
    new_post = models.Post(
        title=post.title,
        description=post.description,
        in_exchange_for=post.in_exchange_for,
        category_id=post.category_id,
        price_from=post.price_from,
        price_to=post.price_to,
        condition_score=post.condition_score,
        user_id=current_user.u_id   #from JWT
    )

    db.add(new_post)
    db.commit()
    db.refresh(new_post)

    return {
        "message": "Post created",
        "post_id": new_post.p_id
    }
