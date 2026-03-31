import uuid
import base64
import logging
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from bson import ObjectId
from ..database import db, UPLOADS_DIR
from ..auth import get_current_user
from ..models import User, RoleUpdate, ProfileUpdate, CustomerPhotoUploadRequest, ProviderSetup

logger = logging.getLogger(__name__)
router = APIRouter()


@router.patch("/users/role", response_model=User)
async def switch_role(role_data: RoleUpdate, current_user: User = Depends(get_current_user)):
      if role_data.currentRole not in ["customer", "provider"]:
                raise HTTPException(status_code=400, detail="Invalid role")
            if role_data.currentRole == "provider" and not current_user.isProviderEnabled:
                      raise HTTPException(status_code=400, detail="Provider setup not complete")

    await db.users.update_one(
              {"_id": ObjectId(current_user.id)},
              {"$set": {"currentRole": role_data.currentRole, "updatedAt": datetime.utcnow()}}
    )
    updated_user = await db.users.find_one({"_id": ObjectId(current_user.id)})
    updated_user["_id"] = str(updated_user["_id"])
    return User(**updated_user)


@router.patch("/users/profile")
async def update_profile(profile_update: ProfileUpdate, current_user: User = Depends(get_current_user)):
      await db.users.update_one(
          {"_id": ObjectId(current_user.id)},
          {"$set": {"name": profile_update.name, "phone": profile_update.phone, "updatedAt": datetime.utcnow()}}
)
    await db.providers.update_one(
              {"userId": current_user.id},
              {"$set": {"name": profile_update.name, "phone": profile_update.phone}}
    )
    updated_user = await db.users.find_one({"_id": ObjectId(current_user.id)})
    updated_user["_id"] = str(updated_user["_id"])
    return updated_user


@router.post("/users/upload-profile-photo")
async def upload_customer_profile_photo(
      upload_data: CustomerPhotoUploadRequest,
      current_user: User = Depends(get_current_user)
):
      try:
                image_data = upload_data.imageData
                if ',' in image_data:
                              image_data = image_data.split(',', 1)[1]

                image_bytes = base64.b64decode(image_data)

        if len(image_bytes) > 10 * 1024 * 1024:
                      raise HTTPException(status_code=400, detail="Image too large. Maximum size is 10MB.")

        # Detect file type
        if image_bytes[:3] == b'\xff\xd8\xff':
                      file_ext = '.jpg'
elif image_bytes[:8] == b'\x89PNG\r\n\x1a\n':
            file_ext = '.png'
else:
            file_ext = '.jpg'

        filename = f"customer_{current_user.id}_{uuid.uuid4().hex[:8]}{file_ext}"
        storage_dir = UPLOADS_DIR / "customer_photos"
        file_path = storage_dir / filename

        with open(file_path, 'wb') as f:
                      f.write(image_bytes)

        file_url = f"/api/uploads/customer_photos/{filename}"

        # Delete old photo if exists
        user_doc = await db.users.find_one({"_id": ObjectId(current_user.id)})
        if user_doc and user_doc.get("profilePhotoUrl"):
                      old_filename = user_doc["profilePhotoUrl"].split("/")[-1]
                      old_file_path = storage_dir / old_filename
                      if old_file_path.exists():
                                        try:
                                                              old_file_path.unlink()
except Exception:
                    pass

        await db.users.update_one(
                      {"_id": ObjectId(current_user.id)},
                      {"$set": {"profilePhotoUrl": file_url, "updatedAt": datetime.utcnow()}}
        )

        updated_user = await db.users.find_one({"_id": ObjectId(current_user.id)})
        updated_user["_id"] = str(updated_user["_id"])
        return User(**updated_user)

except HTTPException:
        raise
except Exception as e:
        logger.error(f"Photo upload error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to upload photo")


@router.get("/uploads/customer_photos/{filename}")
async def get_customer_photo(filename: str):
      file_path = UPLOADS_DIR / "customer_photos" / filename
    if not file_path.exists():
              raise HTTPException(status_code=404, detail="File not found")
          return FileResponse(str(file_path))


@router.post("/users/provider-setup", response_model=User)
async def setup_provider(setup_data: ProviderSetup, current_user: User = Depends(get_current_user)):
      travel_distance_km = setup_data.travelDistanceKm
    if setup_data.travelRadiusMiles is not None:
              travel_distance_km = int(setup_data.travelRadiusMiles * 1.60934)

    travel_radius_miles = int(travel_distance_km / 1.60934)

    provider_doc = {
              "userId": current_user.id,
              "name": current_user.name,
              "email": current_user.email,
              "phone": current_user.phone,
              "services": setup_data.services,
              "bio": setup_data.bio,
              "baseTown": setup_data.baseTown,
              "travelDistanceKm": travel_distance_km,
              "travelRadiusMiles": travel_radius_miles,
              "travelAnywhere": setup_data.travelAnywhere,
              "verificationStatus": "unverified",
              "setupComplete": False,
              "uploadsComplete": False,
              "availabilityStatus": "available",
              "createdAt": datetime.utcnow(),
              "updatedAt": datetime.utcnow(),
    }

    existing_provider = await db.providers.find_one({"userId": current_user.id})
    if existing_provider:
              await db.providers.update_one(
                            {"userId": current_user.id},
                            {"$set": {
                                              "services": setup_data.services,
                                              "bio": setup_data.bio,
                                              "baseTown": setup_data.baseTown,
                                              "travelDistanceKm": travel_distance_km,
                                              "travelRadiusMiles": travel_radius_miles,
                                              "travelAnywhere": setup_data.travelAnywhere,
                                              "updatedAt": datetime.utcnow(),
                            }}
              )
else:
        await db.providers.insert_one(provider_doc)

    await db.users.update_one(
              {"_id": ObjectId(current_user.id)},
              {"$set": {"isProviderEnabled": True, "updatedAt": datetime.utcnow()}}
    )

    updated_user = await db.users.find_one({"_id": ObjectId(current_user.id)})
    updated_user["_id"] = str(updated_user["_id"])
    return User(**updated_user)
