from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Literal
from app import models
from app.utils.dependencies import get_current_user, get_db

router = APIRouter()


class NewReport(BaseModel):
    target_type: Literal["post", "user"]
    target_id: int = Field(gt=0)
    reason: Literal["spam", "fraud", "harassment", "prohibited", "misleading", "other"]
    details: str = Field(min_length=10, max_length=1000)


@router.post("/", status_code=201)
def submit_report(data: NewReport, db: Session = Depends(get_db),
                  reporter: models.User = Depends(get_current_user)):
    details = data.details.strip()
    if len(details) < 10:
        raise HTTPException(400, "Please describe the problem in at least 10 characters")
    post = None
    if data.target_type == "post":
        post = db.get(models.Post, data.target_id)
        if not post or post.status != 1 or not post.user or post.user.status != 1:
            raise HTTPException(404, "This post is no longer available")
        target = db.get(models.User, post.user_id)
    else:
        target = db.get(models.User, data.target_id)
    if not target:
        raise HTTPException(404, "User no longer exists")
    if target.u_id == reporter.u_id:
        raise HTTPException(400, "You cannot report yourself or your own post")
    report = models.UserReport(
        reporter_id=reporter.u_id, reporter_name=reporter.name,
        target_type=data.target_type, target_key=f"{data.target_type}:{data.target_id}",
        target_user_id=target.u_id, post_id=post.p_id if post else None,
        target_name=post.title if post else target.name,
        post_description=post.description if post else None,
        reason=data.reason, details=details,
    )
    db.add(report)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "You already have a pending report for this post or user")
    return {"id": report.id, "message": "Report submitted. An administrator will review it."}
