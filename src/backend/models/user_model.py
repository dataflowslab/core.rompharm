"""
User Model
Local authentication system
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    """Model pentru creare user"""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    firstname: str = Field(..., min_length=1)
    lastname: str = Field(..., min_length=1)
    role_id: str  # ObjectId as string
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    is_active: bool = True
    is_staff: bool = False
    mobile: bool = True  # Default to True as requested


class UserUpdate(BaseModel):
    """Model pentru update user"""
    firstname: Optional[str] = None
    lastname: Optional[str] = None
    role_id: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    is_staff: Optional[bool] = None
    mobile: Optional[bool] = None
    password: Optional[str] = None  # Doar dacă se schimbă parola


class UserLogin(BaseModel):
    """Model pentru login"""
    username: str
    password: str


class RoleCreate(BaseModel):
    """Model pentru creare role"""
    name: str = Field(..., min_length=1)
    slug: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None


class RoleUpdate(BaseModel):
    """Model pentru update role"""
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    items: Optional[list[str]] = None  # Array de permission slugs


class PermissionItem(BaseModel):
    """Model pentru permission item"""
    slug: str
    description: Optional[str] = None
