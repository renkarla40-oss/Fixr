import os
import jwt
from datetime import datetime, timedelta
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from bson import ObjectId
from .database import db
from .models import User

SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_DAYS = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


def verify_password(plain_password, hashed_password):
      return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
      return pwd_context.hash(password)


def create_access_token(data: dict):
      to_encode = data.copy()
      expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
      to_encode.update({"exp": expire})
      return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
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

    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user is None:
              raise HTTPException(status_code=401, detail="User not found")

    user["_id"] = str(user["_id"])
    return User(**user)
