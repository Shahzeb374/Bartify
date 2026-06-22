from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine
from app import models
from app.routes import users, posts
from fastapi.staticfiles import StaticFiles


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    # allow_origins=[
    #     "http://127.0.0.1:5500",
    #     "http://localhost:5500",
    #     "http://127.0.0.1:3000",
    #     "http://localhost:3000",
    # ],
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB tables
models.Base.metadata.create_all(bind=engine)

# Static files for profile images
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Routers
app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(posts.router, prefix="/posts", tags=["Posts"])

# Test route
@app.get("/")
def home():
    return {"message": "API is running"}

