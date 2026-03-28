# backend/app/services/auth_service.py
# Responsibility: Authentication helper functions.
# Phase 2: Shared foundations. Exact copies of helper functions from server.py.
# server.py retains its own copies until the switch-over is approved in Phase 3+.
# This module is importable but not yet wired to any active route.

import random
import jwt
from datetime import datetime, timedelta
from passlib.context import CryptContext

from app.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_DAYS

# Password hashing context — matches server.py: CryptContext(schemes=["bcrypt"], deprecated="auto")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain-text password against a bcrypt hash.
    Exact copy of verify_password() from server.py.
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Hash a plain-text password using bcrypt.
    Exact copy of get_password_hash() from server.py.
    """
    return pwd_context.hash(password)


def create_access_token(data: dict) -> str:
    """
    Create a signed JWT access token.
    Exact copy of create_access_token() from server.py.
    Expiry: ACCESS_TOKEN_EXPIRE_DAYS (30 days).
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def generate_otp() -> str:
    """
    Generate a 6-digit OTP code.
    Exact copy of generate_otp() from server.py.
    Used for phone number verification.
    """
    return str(random.randint(100000, 999999))


def generate_job_code() -> str:
    """
    Generate a 6-digit job confirmation code.
    Exact copy of generate_job_code() from server.py.
    Used for OTP-based job start and completion verification.
    """
    return str(random.randint(100000, 999999))
