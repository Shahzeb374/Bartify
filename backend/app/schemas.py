from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

#  ROLE SCHEMAS

class RoleBase(BaseModel):
    role: str = Field(..., max_length=50)


class RoleCreate(RoleBase):
    pass


class RoleResponse(RoleBase):
    r_id: int
    created_at: datetime

    class Config:
        from_attributes = True


#  USER SCHEMAS

class UserBase(BaseModel):
    name: str = Field(..., max_length=100)
    email: EmailStr
    contact: Optional[str] = Field(None, max_length=20)
    user_image: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=255)
    role_id: Optional[int] = Field(default=1)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    contact: Optional[str] = Field(None, max_length=20)
    user_image: Optional[str] = None
    status: Optional[int] = None


class UserResponse(UserBase):
    u_id: int
    role_id: int
    status: int
    created_at: datetime
    role: Optional[RoleResponse] = None

    class Config:
        from_attributes = True


#  CATEGORY SCHEMAS

class CategoryBase(BaseModel):
    category: str = Field(..., max_length=100)


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    category: Optional[str] = Field(None, max_length=100)
    status: Optional[int] = None


class CategoryResponse(CategoryBase):
    c_id: int
    status: int

    class Config:
        from_attributes = True


#  PRODUCT IMAGE SCHEMAS

class ProductImageBase(BaseModel):
    image_url: str


class ProductImageCreate(ProductImageBase):
    product_id: int


class ProductImageResponse(ProductImageBase):
    i_id: int
    product_id: int
    status: int

    class Config:
        from_attributes = True


#  POST SCHEMAS

class PostBase(BaseModel):
    title: str = Field(..., max_length=255)
    description: str
    in_exchange_for: str = Field(..., max_length=255)
    category_id: int
    price_from: float = Field(..., ge=0)
    price_to: float = Field(..., ge=0)
    condition_score: int = Field(..., ge=1, le=10)


class PostCreate(PostBase):
    pass

class PostUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    in_exchange_for: Optional[str] = Field(None, max_length=255)
    category_id: Optional[int] = None
    price_from: Optional[float] = Field(None, ge=0)
    price_to: Optional[float] = Field(None, ge=0)
    condition_score: Optional[int] = Field(None, ge=1, le=10)
    status: Optional[int] = None


class PostResponse(PostBase):
    p_id: int
    user_id: int
    status: int
    created_at: datetime
    user: Optional[UserResponse] = None
    category: Optional[CategoryResponse] = None
    images: Optional[List[ProductImageResponse]] = []

    class Config:
        from_attributes = True


#  GENERIC RESPONSE WRAPPERS

class SuccessResponse(BaseModel):
    success: bool = True
    message: str
    data: Optional[dict] = None


class PaginatedPostsResponse(BaseModel):
    total: int
    page: int
    page_size: int
    posts: List[PostResponse]