import uuid
import base64
import random
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import FileResponse
from bson import ObjectId
from ..database import db, UPLOADS_DIR
from ..auth import get_current_user
from ..models import (
    User, Provider, ProviderAvailabilityUpdate, PhotoUploadRequest,
    SendOTPRequest, VerifyOTPRequest, OTPResponse
)

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory OTP storage (use Redis with TTL in production)
otp_storage = {}


def generate_otp() -> str:
      return str(random.randint(100000, 999999))


def _serialize_provider(p: dict) -> dict:
      p = p.copy()
      p["_id"] = str(p["_id"])
      return p


@router.get("/providers", response_model=List[Provider])
async def get_providers(
      service: Optional[str] = None,
      job_town: Optional[str] = None,
      search_radius: int = 10,
      include_travel_anywhere: bool = False,
      current_user: User = Depends(get_current_user)
):
      query = {"setupComplete": True, "availabilityStatus": "available"}
      if service:
                query["services"] = {"$in": [service]}

      providers = await db.providers.find(query).to_list(length=100)
      result = []
      for p in providers:
                p["_id"] = str(p["_id"])
                try:
                              result.append(Provider(**p))
except Exception:
            pass
    return result


@router.get("/towns")
async def get_towns(current_user: User = Depends(get_current_user)):
      towns = [
                "London", "Manchester", "Birmingham", "Leeds", "Glasgow",
                "Liverpool", "Bristol", "Sheffield", "Edinburgh", "Cardiff",
                "Leicester", "Coventry", "Bradford", "Nottingham", "Kingston upon Hull",
                "Stoke-on-Trent", "Wolverhampton", "Plymouth", "Southampton", "Reading",
                "Derby", "Dudley", "Newcastle upon Tyne", "Sunderland", "Brighton",
                "Luton", "Bolton", "Bournemouth", "Norwich", "Swindon",
                "Swansea", "Southend-on-Sea", "Middlesbrough", "Peterborough", "West Bromwich",
                "Huddersfield", "Oxford", "Poole", "Ipswich", "Telford",
                "Aberdeen", "Dundee", "Exeter", "York", "Cambridge",
                "Gloucester", "Blackpool", "Blackburn", "Bath", "Chester"
      ]
      return {"towns": sorted(towns)}


@router.get("/providers/me/profile")
async def get_my_provider_profile(current_user: User = Depends(get_current_user)):
      provider = await db.providers.find_one({"userId": current_user.id})
      if not provider:
                raise HTTPException(status_code=404, detail="Provider profile not found")
            provider["_id"] = str(provider["_id"])
    return provider


@router.get("/providers/{provider_id}", response_model=Provider)
async def get_provider(provider_id: str, current_user: User = Depends(get_current_user)):
      try:
                provider = await db.providers.find_one({"_id": ObjectId(provider_id)})
except Exception:
        provider = await db.providers.find_one({"userId": provider_id})
    if not provider:
              raise HTTPException(status_code=404, detail="Provider not found")
          provider["_id"] = str(provider["_id"])
    return Provider(**provider)


@router.patch("/providers/me/availability", response_model=Provider)
async def update_availability(
      availability: ProviderAvailabilityUpdate,
      current_user: User = Depends(get_current_user)
):
      if availability.availabilityStatus not in ["available", "away"]:
                raise HTTPException(status_code=400, detail="Invalid availability status")

    await db.providers.update_one(
              {"userId": current_user.id},
              {"$set": {"availabilityStatus": availability.availabilityStatus, "updatedAt": datetime.utcnow()}}
    )
    provider = await db.providers.find_one({"userId": current_user.id})
    if not provider:
              raise HTTPException(status_code=404, detail="Provider not found")
          provider["_id"] = str(provider["_id"])
    return Provider(**provider)


@router.post("/providers/me/upload", response_model=Provider)
async def upload_provider_photo(
      upload_data: PhotoUploadRequest,
      current_user: User = Depends(get_current_user)
):
      try:
                image_data = upload_data.imageData
                if ',' in image_data:
                              image_data = image_data.split(',', 1)[1]
                          image_bytes = base64.b64decode(image_data)

          if len(image_bytes) > 10 * 1024 * 1024:
                        raise HTTPException(status_code=400, detail="Image too large")

        if image_bytes[:3] == b'\xff\xd8\xff':
                      file_ext = '.jpg'
elif image_bytes[:8] == b'\x89PNG\r\n\x1a\n':
            file_ext = '.png'
else:
            file_ext = '.jpg'

        upload_type = upload_data.uploadType

        if upload_type == "profile_photo":
                      subdir = "profile_photos"
                      filename = f"provider_{current_user.id}_{uuid.uuid4().hex[:8]}{file_ext}"
                      field = "profilePhotoUrl"
elif upload_type == "government_id_front":
            subdir = "government_ids"
            filename = f"gov_front_{current_user.id}_{uuid.uuid4().hex[:8]}{file_ext}"
            field = "governmentIdFrontUrl"
elif upload_type == "government_id_back":
            subdir = "government_ids"
            filename = f"gov_back_{current_user.id}_{uuid.uuid4().hex[:8]}{file_ext}"
            field = "governmentIdBackUrl"
else:
            raise HTTPException(status_code=400, detail="Invalid upload type")

        storage_dir = UPLOADS_DIR / subdir
        file_path = storage_dir / filename
        with open(file_path, 'wb') as f:
                      f.write(image_bytes)

        file_url = f"/api/uploads/profile_photos/{filename}" if subdir == "profile_photos" else f"/api/uploads/profile_photos/{filename}"

        await db.providers.update_one(
                      {"userId": current_user.id},
                      {"$set": {field: file_url, "updatedAt": datetime.utcnow()}}
        )

        # Check if uploads are complete
        provider = await db.providers.find_one({"userId": current_user.id})
        if provider:
                      has_profile = bool(provider.get("profilePhotoUrl"))
                      has_front = bool(provider.get("governmentIdFrontUrl"))
                      has_back = bool(provider.get("governmentIdBackUrl"))
                      if has_profile and has_front and has_back:
                                        await db.providers.update_one(
                                                              {"userId": current_user.id},
                                                              {"$set": {"uploadsComplete": True, "setupComplete": True, "verificationStatus": "pending"}}
                                        )
                                        await db.users.update_one(
                                            {"_id": ObjectId(current_user.id)},
                                            {"$set": {"isProviderEnabled": True}}
                                        )

                  provider = await db.providers.find_one({"userId": current_user.id})
        provider["_id"] = str(provider["_id"])
        return Provider(**provider)

except HTTPException:
        raise
except Exception as e:
        logger.error(f"Provider upload error: {str(e)}")
        raise HTTPException(status_code=500, detail="Upload failed")


@router.get("/uploads/profile_photos/{filename}")
async def get_profile_photo(filename: str):
      for subdir in ["profile_photos", "government_ids"]:
                file_path = UPLOADS_DIR / subdir / filename
                if file_path.exists():
                              return FileResponse(str(file_path))
                      raise HTTPException(status_code=404, detail="File not found")


@router.post("/providers/me/phone/send-otp", response_model=OTPResponse)
async def send_phone_otp(otp_data: SendOTPRequest, current_user: User = Depends(get_current_user)):
      phone = otp_data.phone.strip()
    otp = generate_otp()
    otp_storage[phone] = {
              "otp": otp,
              "expires": datetime.now(timezone.utc) + timedelta(minutes=10),
              "userId": current_user.id
  }
    logger.info(f"OTP for {phone}: {otp}")
    return OTPResponse(success=True, message=f"Verification code sent to {phone}. Code: {otp}")


@router.post("/providers/me/phone/verify", response_model=OTPResponse)
async def verify_phone_otp(verify_data: VerifyOTPRequest, current_user: User = Depends(get_current_user)):
      phone = verify_data.phone.strip()
    otp = verify_data.otp.strip()

    stored = otp_storage.get(phone)
    if not stored:
              return OTPResponse(success=False, message="Verification code not found or expired")

    if datetime.now(timezone.utc) > stored["expires"]:
              del otp_storage[phone]
        return OTPResponse(success=False, message="Verification code has expired")

    if stored["otp"] != otp:
              return OTPResponse(success=False, message="Invalid verification code")

    del otp_storage[phone]

    await db.providers.update_one(
              {"userId": current_user.id},
              {"$set": {"phone": phone, "phoneVerified": True, "updatedAt": datetime.utcnow()}}
    )

    return OTPResponse(success=True, message="Phone number verified successfully")


@router.get("/providers/me/earnings")
async def get_provider_earnings(current_user: User = Depends(get_current_user)):
      provider = await db.providers.find_one({"userId": current_user.id})
    if not provider:
              raise HTTPException(status_code=404, detail="Provider profile not found")

    provider_id = str(provider["_id"])

    completed_statuses = ["completed_pending_review", "completed_reviewed", "completed"]
    transactions = await db.payment_transactions.find({
              "providerId": provider_id
    }).to_list(length=1000)

    total_held = 0.0
    total_available = 0.0
    total_lifetime = 0.0

    for txn in transactions:
              amount = txn.get("providerAmount", txn.get("amount", 0)) or 0
              job_id = txn.get("jobId") or txn.get("requestId")
              if job_id:
                            try:
                                              job = await db.service_requests.find_one({"_id": ObjectId(job_id)})
                                              if job and job.get("status") in completed_statuses:
                                                                    total_available += amount
                                                                    total_lifetime += amount
                            else:
                                                  total_held += amount
                            except Exception:
                                total_held += amount
else:
            total_held += amount

    return {
              "heldBalance": round(total_held, 2),
              "availableBalance": round(total_available, 2),
              "lifetimeEarned": round(total_lifetime, 2),
              "currency": "GBP"
    }
