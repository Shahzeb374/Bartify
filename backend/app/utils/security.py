from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str):
    return pwd_context.hash(password[:72])  # Limit to 72 chars for bcrypt

def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)