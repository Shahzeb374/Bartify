from sqlalchemy import Column, Integer, String, Text, ForeignKey, TIMESTAMP, Numeric
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


#ROLES
class Role(Base):
    __tablename__ = "roles"

    r_id = Column(Integer, primary_key=True, index=True)
    role = Column(String(50), unique=True, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    users = relationship("User", back_populates="role")


#USERS
class User(Base):
    __tablename__ = "users"

    u_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password = Column(String(255),nullable=False)
    contact = Column(String(20), nullable=True)
    user_image = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    role_id = Column(Integer, ForeignKey("roles.r_id"), default=1)
    status = Column(Integer, default=1)

    role = relationship("Role", back_populates="users")
    posts = relationship("Post", back_populates="user", cascade="all, delete")


#CATEGORIES
class Category(Base):
    __tablename__ = "categories"

    c_id = Column(Integer, primary_key=True, index=True)
    category = Column(String(100), unique=True, nullable=False)
    status = Column(Integer, default=1)

    posts = relationship("Post", back_populates="category")


#POSTS
class Post(Base):
    __tablename__ = "posts"

    p_id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.u_id"))
    title = Column(String(255), nullable=False)
    description = Column(String(100), nullable=False)
    in_exchange_for = Column(String(255), nullable=False)

    category_id = Column(Integer, ForeignKey("categories.c_id"))

    price_from = Column(Numeric, nullable=False)
    price_to = Column(Numeric, nullable=False)
    condition_score = Column(Integer, nullable=False)

    status = Column(Integer, default=1)
    created_at = Column(TIMESTAMP, server_default=func.now())

    user = relationship("User", back_populates="posts")
    category = relationship("Category", back_populates="posts")
    images = relationship("ProductImage", back_populates="post", cascade="all, delete")


#PRODUCT IMAGES
class ProductImage(Base):
    __tablename__ = "product_images"

    i_id = Column(Integer, primary_key=True, index=True)

    product_id = Column(Integer, ForeignKey("posts.p_id"))
    image_url = Column(Text)
    status = Column(Integer, default=1)

    post = relationship("Post", back_populates="images")


#OFFERS  (jab koi user kisi post pr "Offer Exchange" kre)
class Offer(Base):
    __tablename__ = "offers"

    o_id = Column(Integer, primary_key=True, index=True)

    post_id = Column(Integer, ForeignKey("posts.p_id", ondelete="CASCADE"), nullable=False)
    offering_user_id = Column(Integer, ForeignKey("users.u_id", ondelete="CASCADE"), nullable=False)

    title = Column(String(255), nullable=False)
    description = Column(String(500), nullable=True)
    category_id = Column(Integer, ForeignKey("categories.c_id"), nullable=True)

    price_from = Column(Numeric, nullable=True)
    price_to = Column(Numeric, nullable=True)
    condition_score = Column(Integer, nullable=True)

    status = Column(Integer, default=1)  # 1=pending, future: accepted/rejected
    created_at = Column(TIMESTAMP, server_default=func.now())

    post = relationship("Post")
    offering_user = relationship("User")
    category = relationship("Category")
    images = relationship("OfferImage", back_populates="offer", cascade="all, delete")


#OFFER IMAGES
class OfferImage(Base):
    __tablename__ = "offer_images"

    oi_id = Column(Integer, primary_key=True, index=True)

    offer_id = Column(Integer, ForeignKey("offers.o_id", ondelete="CASCADE"))
    image_url = Column(Text)
    status = Column(Integer, default=1)

    offer = relationship("Offer", back_populates="images")