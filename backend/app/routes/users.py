from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
import os
import shutil
from app.database import SessionLocal
from app import models, schemas
from app.utils.security import hash_password, verify_password
from app.auth import create_access_token
from app.utils.dependencies import get_db

router = APIRouter()

# Upload folder path
UPLOAD_DIR = "uploads/profiles"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# SIGNUP
@router.post("/signup")
async def signup(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    contact: str = Form(None),
    user_image: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    image_path = None
    if user_image:
        file_ext = user_image.filename.split(".")[-1]
        file_name = f"{email.split('@')[0]}_{int.from_bytes(os.urandom(4), 'big')}.{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, file_name)

        contents = await user_image.read()
        with open(file_path, "wb") as f:
            f.write(contents)

        image_path = f"/uploads/profiles/{file_name}"
    
    new_user = models.User(
        name=name,
        email=email,
        password=hash_password(password),
        contact=contact,
        user_image=image_path
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token({"user_id": new_user.u_id})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": new_user.u_id,
            "name": new_user.name,
            "email": new_user.email,
            "picture": new_user.user_image
        }
    }

@router.post("/login")
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    
    if not db_user or not verify_password(user.password, db_user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"user_id": db_user.u_id})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": db_user.u_id,
            "name": db_user.name,
            "email": db_user.email,
            "picture": db_user.user_image
        }
    }