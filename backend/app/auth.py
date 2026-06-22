from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone

SECRET_KEY = "secret123"   # change later
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)