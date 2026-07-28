from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
import os
import shutil
from app.database import SessionLocal
from app import models, schemas
from app.utils.security import hash_password, verify_password
from app.auth import create_access_token
from app.utils.dependencies import get_db, get_current_user

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


# ═══ UPDATE PROFILE ═══
@router.put("/profile")
async def update_profile(
    name: str = Form(None),
    contact: str = Form(None),
    user_image: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if name:
        current_user.name = name.strip()
    if contact:
        current_user.contact = contact.strip()
    
    if user_image:
        # ← Purani image delete karo
        if current_user.user_image and current_user.user_image.startswith('/uploads/profiles/'):
            old_file = current_user.user_image.replace('/uploads/profiles/', '')
            old_path = os.path.join(UPLOAD_DIR, old_file)
            if os.path.exists(old_path):
                os.remove(old_path)
        
        # ← Naya image save karo
        file_ext = user_image.filename.split(".")[-1]
        file_name = f"{current_user.email.split('@')[0]}_{int.from_bytes(os.urandom(4), 'big')}.{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, file_name)
        contents = await user_image.read()
        with open(file_path, "wb") as f:
            f.write(contents)
        current_user.user_image = f"/uploads/profiles/{file_name}"
    
    db.commit()
    db.refresh(current_user)
    
    return {
        "message": "Profile updated successfully",
        "user": {
            "id": current_user.u_id,
            "name": current_user.name,
            "email": current_user.email,
            "contact": current_user.contact,
            "picture": current_user.user_image
        }
    }


# ═══ CHANGE PASSWORD ═══
@router.post("/change-password")
async def change_password(
    current_password: str = Form(...),
    new_password: str = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Verify current password
    if not verify_password(current_password, current_user.password):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    # Validate new password strength
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    if not any(c.isupper() for c in new_password):
        raise HTTPException(status_code=400, detail="Password must contain uppercase letter")
    
    if not any(c.isdigit() for c in new_password):
        raise HTTPException(status_code=400, detail="Password must contain digit")
    
    if not any(c in "!@#$%^&*()_+-=[]{}';:,.<>?" for c in new_password):
        raise HTTPException(status_code=400, detail="Password must contain special character")
    
    # Update password
    current_user.password = hash_password(new_password)
    db.commit()
    
    return {"message": "Password changed successfully"}