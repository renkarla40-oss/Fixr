import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from ..database import db
from ..auth import get_current_user, get_password_hash, verify_password, create_access_token
from ..models import User, UserCreate, Token, LoginRequest, SocialAuthRequest

logger = logging.getLogger(__name__)
router = APIRouter()


def is_test_email(email: str) -> bool:
      return email.lower().endswith("@test.com")


@router.post("/auth/signup", response_model=Token)
async def signup(user_data: UserCreate):
      existing_user = await db.users.find_one({"email": user_data.email})
      if existing_user:
                raise HTTPException(status_code=400, detail="Email already registered")

      hashed_password = get_password_hash(user_data.password)
      user_dict = user_data.model_dump()
      user_dict["password"] = hashed_password
      user_dict["isProviderEnabled"] = False
      user_dict["createdAt"] = datetime.utcnow()
      user_dict["updatedAt"] = datetime.utcnow()
      user_dict["isBetaUser"] = is_test_email(user_data.email)

    result = await db.users.insert_one(user_dict)
    user_dict["_id"] = str(result.inserted_id)

    access_token = create_access_token(data={"sub": str(result.inserted_id)})
    return Token(token=access_token, user=User(**user_dict))


@router.post("/auth/login", response_model=Token)
async def login(login_data: LoginRequest):
      user = await db.users.find_one({"email": login_data.email})
      if not user:
                raise HTTPException(status_code=401, detail="Invalid email or password")
            if not verify_password(login_data.password, user["password"]):
                      raise HTTPException(status_code=401, detail="Invalid email or password")

    if is_test_email(login_data.email) and not user.get("isBetaUser", False):
              await db.users.update_one(
                            {"_id": user["_id"]},
                            {"$set": {"isBetaUser": True, "updatedAt": datetime.utcnow()}}
              )
              user["isBetaUser"] = True

    user["_id"] = str(user["_id"])
    access_token = create_access_token(data={"sub": user["_id"]})
    return Token(token=access_token, user=User(**user))


@router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
      return current_user


@router.post("/auth/social", response_model=Token)
async def social_auth(auth_data: SocialAuthRequest):
      try:
                logger.info(f"Social auth: provider={auth_data.provider}, email={auth_data.email}")

        user = await db.users.find_one({
                      "authProvider": auth_data.provider,
                      "providerId": auth_data.providerId
        })

        if not user and auth_data.email:
                      user = await db.users.find_one({"email": auth_data.email})
                      if user:
                                        await db.users.update_one(
                                                 {"_id": user["_id"]},
                                                              {"$set": {
                                                                                        "authProvider": auth_data.provider,
                                                                                        "providerId": auth_data.providerId,
                                                                                        "updatedAt": datetime.utcnow()
                                                              }}
                                        )

                  if user:
                                user["_id"] = str(user["_id"])
                                if not user.get("isBetaUser", False):
                                                  await db.users.update_one(
                                                                        {"_id": ObjectId(user["_id"])},
                                                                        {"$set": {"isBetaUser": True, "updatedAt": datetime.utcnow()}}
                                                  )
                                                  user["isBetaUser"] = True
                                              access_token = create_access_token(data={"sub": user["_id"]})
            return Token(token=access_token, user=User(**user))

        email = auth_data.email or f"{auth_data.providerId}@social.fixr"
        name = auth_data.name or email.split("@")[0]

        user_dict = {
                      "email": email,
                      "name": name,
                      "phone": "",
                      "currentRole": "customer",
                      "isProviderEnabled": False,
                      "isBetaUser": True,
                      "authProvider": auth_data.provider,
                      "providerId": auth_data.providerId,
                      "password": "",
                      "createdAt": datetime.utcnow(),
                      "updatedAt": datetime.utcnow(),
        }
        result = await db.users.insert_one(user_dict)
        user_dict["_id"] = str(result.inserted_id)
        access_token = create_access_token(data={"sub": str(result.inserted_id)})
        return Token(token=access_token, user=User(**user_dict))

except Exception as e:
        logger.error(f"Social auth error: {str(e)}")
        raise HTTPException(status_code=500, detail="Social authentication failed")
