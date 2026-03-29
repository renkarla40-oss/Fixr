# backend/app/dependencies.py
# Responsibility: Shared FastAPI dependency injection functions.
# Phase 2: Shared foundations. server.py remains the active backend.
# This module is importable but not yet wired to any active route.
# get_current_user here is an exact copy of the one in server.py.
# server.py continues using its own copy until Phase 3+ switches over.
# Phase 4 update: get_current_user now returns User(**user) to match server.py exactly.

import jwt
from bson import ObjectId
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config import SECRET_KEY, ALGORITHM
from app.database import get_db
from app.schemas.user import User

# Security scheme — matches server.py: security = HTTPBearer()
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Validate JWT bearer token and return the current user as a User model.
    Exact copy of get_current_user() from server.py, returns User(**user).
    Not yet wired to any active route — dormant until main.py becomes the entrypoint.
    """
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    user["_id"] = str(user["_id"])
    return User(**user)
