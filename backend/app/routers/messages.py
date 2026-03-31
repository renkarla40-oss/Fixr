import uuid
import base64
import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from bson import ObjectId
from pydantic import BaseModel
from typing import Optional
from ..database import db, UPLOADS_DIR
from ..auth import get_current_user
from ..models import User

logger = logging.getLogger(__name__)
router = APIRouter()


class SendMessageRequest(BaseModel):
      content: str
      messageType: Optional[str] = "text"


class MarkReadRequest(BaseModel):
      requestId: str
      role: Optional[str] = None


@router.get("/service-requests/{request_id}/messages")
async def get_job_messages(request_id: str, current_user: User = Depends(get_current_user)):
      request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
      if not request:
                raise HTTPException(status_code=404, detail="Request not found")

      # Verify access
      provider = await db.providers.find_one({"userId": current_user.id})
      provider_id = str(provider["_id"]) if provider else None
      if str(request.get("customerId")) != current_user.id and request.get("providerId") != provider_id:
                raise HTTPException(status_code=403, detail="Access denied")

      messages = await db.messages.find({"requestId": request_id}).sort("createdAt", 1).to_list(length=500)
      for msg in messages:
                msg["_id"] = str(msg["_id"])
            return messages


@router.post("/service-requests/{request_id}/messages")
async def send_message(request_id: str, message_data: SendMessageRequest, current_user: User = Depends(get_current_user)):
      request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
              raise HTTPException(status_code=404, detail="Request not found")

    provider = await db.providers.find_one({"userId": current_user.id})
    provider_id = str(provider["_id"]) if provider else None
    is_customer = str(request.get("customerId")) == current_user.id
    is_provider = provider_id and request.get("providerId") == provider_id

    if not is_customer and not is_provider:
              raise HTTPException(status_code=403, detail="Access denied")

    msg_doc = {
              "requestId": request_id,
              "senderId": current_user.id,
              "senderName": current_user.name,
              "senderRole": "customer" if is_customer else "provider",
              "content": message_data.content,
              "messageType": message_data.messageType or "text",
              "readByCustomer": is_customer,
              "readByProvider": is_provider,
              "createdAt": datetime.utcnow(),
                                    }
    result = await db.messages.insert_one(msg_doc)
    msg_doc["_id"] = str(result.inserted_id)
    return msg_doc


@router.patch("/service-requests/{request_id}/messages/seen")
async def mark_messages_seen(request_id: str, current_user: User = Depends(get_current_user)):
      request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
              raise HTTPException(status_code=404, detail="Request not found")

    provider = await db.providers.find_one({"userId": current_user.id})
    provider_id = str(provider["_id"]) if provider else None
    is_customer = str(request.get("customerId")) == current_user.id

    if is_customer:
              await db.messages.update_many(
                            {"requestId": request_id, "readByCustomer": False},
                            {"$set": {"readByCustomer": True}}
              )
else:
        await db.messages.update_many(
                      {"requestId": request_id, "readByProvider": False},
                      {"$set": {"readByProvider": True}}
        )
      return {"success": True}


@router.post("/messages/mark-read")
async def mark_messages_read(mark_data: MarkReadRequest, current_user: User = Depends(get_current_user)):
      request_id = mark_data.requestId
    request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
              raise HTTPException(status_code=404, detail="Request not found")

    provider = await db.providers.find_one({"userId": current_user.id})
    provider_id = str(provider["_id"]) if provider else None
    is_customer = str(request.get("customerId")) == current_user.id

    if is_customer:
              await db.messages.update_many(
                            {"requestId": request_id, "readByCustomer": False},
                            {"$set": {"readByCustomer": True}}
              )
else:
          await db.messages.update_many(
                        {"requestId": request_id, "readByProvider": False},
                        {"$set": {"readByProvider": True}}
          )
      return {"success": True}


@router.post("/uploads/chat-image")
async def upload_chat_image(current_user: User = Depends(get_current_user)):
      raise HTTPException(status_code=501, detail="Use multipart form for chat image upload")


@router.get("/uploads/chat_images/{filename}")
async def get_chat_image(filename: str):
      file_path = UPLOADS_DIR / "chat_images" / filename
      if not file_path.exists():
                raise HTTPException(status_code=404, detail="File not found")
            return FileResponse(str(file_path))
