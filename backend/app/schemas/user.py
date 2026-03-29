# backend/app/schemas/user.py
# Responsibility: Pydantic models for User domain.
# Phase 4: Exact copies of User-related models from server.py.
# server.py retains its own copies until it is decommissioned in Phase 10.

from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime


class UserBase(BaseModel):
    email: EmailStr
    name: str
    phone: str
    currentRole: str = Field(default="customer")


class UserCreate(UserBase):
    password: str


class User(UserBase):
    id: str = Field(alias="_id")
    isProviderEnabled: bool = False
    isBetaUser: bool = False
    profilePhotoUrl: Optional[str] = None  # Customer profile photo URL
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


class UserInDB(User):
    password: str


class Token(BaseModel):
    token: str
    user: User
