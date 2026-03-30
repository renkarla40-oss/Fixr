# backend/app/services/message_service.py
# Responsibility: All human chat message business logic.
# Phase 6: Business logic migrated from server.py. server.py remains the active backend.
# All 4 functions are exact copies from server.py.
# send_job_message uses notify_fn injection — no server.py import in this file.
# NotificationType.NEW_MESSAGE value "new_message" used as inline string.
# upload_chat_image and get_chat_image are NOT migrated (filesystem dependency).

from bson import ObjectId
from fastapi import HTTPException
from datetime import datetime
from typing import Optional, Callable
import logging

logger = logging.getLogger(__name__)


# =============================================================================
# GET JOB MESSAGES
# Extracted from get_job_messages() in server.py (~line 2581).
# =============================================================================
async def get_job_messages(request_id: str, current_user, db):
    """
    Get messages for a job. Keeps communication in-app.
    """
    request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    # Verify user is part of this request
    is_customer = request["customerId"] == current_user.id
    provider = await db.providers.find_one({"userId": current_user.id})
    is_assigned_provider = provider and str(provider["_id"]) == request.get("providerId")

    # For general requests (providerId is null), allow any provider to view messages
    # This supports the "Other Services" flow where requests are broadcast to all providers
    is_general_request = request.get("isGeneralRequest", False) and request.get("providerId") is None
    is_provider_for_general = provider and is_general_request

    if not is_customer and not is_assigned_provider and not is_provider_for_general:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get messages
    messages = await db.job_messages.find({"requestId": request_id}).sort("createdAt", 1).to_list(100)
    for msg in messages:
        msg["_id"] = str(msg["_id"])

    return {"messages": messages}


# =============================================================================
# SEND JOB MESSAGE
# Extracted from send_job_message() in server.py (~line 2660).
# notify_fn injected by route layer — no server.py import here.
# NotificationType.NEW_MESSAGE = "new_message" used inline.
# =============================================================================
async def send_job_message(request_id: str, message: dict, current_user, db, notify_fn: Optional[Callable] = None):
    """
    Send a message within a job. No phone numbers exposed.
    Supports text and image messages.
    Framing: "Keep all job communication in one place"
    """
    request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    # Block messaging ONLY after review is submitted (completed_reviewed)
    # Chat stays OPEN for: in_progress, completed_pending_review
    # Chat CLOSED for: completed_reviewed
    job_status = request.get("status", "")
    if job_status == "completed_reviewed":
        raise HTTPException(status_code=403, detail="Chat is read-only after review is submitted.")

    # Verify user is part of this request
    is_customer = request["customerId"] == current_user.id
    provider = await db.providers.find_one({"userId": current_user.id})
    is_provider = provider and str(provider["_id"]) == request.get("providerId")

    if not is_customer and not is_provider:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Determine message type
    msg_type = message.get("type", "text")
    if msg_type not in ["text", "image"]:
        msg_type = "text"

    # Create message with delivery tracking
    now = datetime.utcnow()
    msg_dict = {
        "requestId": request_id,
        "senderId": current_user.id,
        "senderName": current_user.name,
        "senderRole": "provider" if is_provider else "customer",
        "type": msg_type,
        "text": message.get("text", "")[:1000] if msg_type == "text" else message.get("text", ""),
        "imageUrl": message.get("imageUrl") if msg_type == "image" else None,
        "createdAt": now,
        "deliveredAt": now,  # Set delivered immediately on save
        "readAt": None,  # Will be set when recipient opens Messages tab
    }

    result = await db.job_messages.insert_one(msg_dict)
    msg_dict["_id"] = str(result.inserted_id)

    # Update last_message_at on the service request for unread tracking
    # Also update sender's last_read_at (they've seen their own message)
    update_fields = {"last_message_at": now}
    if is_provider:
        update_fields["provider_last_read_at"] = now
    else:
        update_fields["customer_last_read_at"] = now

    await db.service_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": update_fields}
    )

    # Send notification to the other party
    recipient_id = request["providerId"] if is_customer else request["customerId"]

    # Get provider user ID if recipient is provider
    if not is_customer:
        recipient_id = request["customerId"]
    else:
        # Get provider's user ID
        provider_doc = await db.providers.find_one({"_id": ObjectId(request.get("providerId"))})
        if provider_doc:
            recipient_id = provider_doc["userId"]

    # Notification body based on message type
    notification_body = "📷 Sent an image" if msg_type == "image" else message.get("text", "")[:100]

    if recipient_id and notify_fn:
        await notify_fn(
            user_id=recipient_id,
            title=f"New message from {current_user.name}",
            body=notification_body,
            data={
                "type": "new_message",
                "requestId": request_id,
            }
        )

    return {"success": True, "message": msg_dict}

# =============================================================================
# MARK MESSAGES AS SEEN
# Extracted from mark_messages_as_seen() in server.py (~line 2754).
# =============================================================================
async def mark_messages_as_seen(request_id: str, current_user, db):
    """
    Mark all messages from the other user as seen/read for the current user.
    Called when user opens the Messages tab.
    Sets readAt timestamp for messages where senderRole is the other party
    and readAt is null. System messages are no longer written to job_messages (Phase 11).
    """
    request = await db.service_requests.find_one({"_id": ObjectId(request_id)})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    # Verify user is part of this request
    is_customer = request["customerId"] == current_user.id
    provider = await db.providers.find_one({"userId": current_user.id})
    is_provider = provider and str(provider["_id"]) == request.get("providerId")

    if not is_customer and not is_provider:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Mark all messages from the OTHER user AND system messages as read
    # If I'm customer, mark provider + system messages as read
    # If I'm provider, mark customer + system messages as read
    other_role = "provider" if is_customer else "customer"

    now = datetime.utcnow()
    result = await db.job_messages.update_many(
        {
            "requestId": request_id,
            "senderRole": other_role,
            "readAt": None  # Only update messages not yet read
        },
        {"$set": {"readAt": now}}
    )

    return {
        "success": True,
        "markedCount": result.modified_count,
        "readAt": now.isoformat()
    }


# =============================================================================
# MARK MESSAGES READ
# Extracted from mark_messages_read() in server.py (~line 2799).
# Uses per-user read tracking: customer_last_read_at / provider_last_read_at
# =============================================================================
async def mark_messages_read(body: dict, current_user, db):
    """
    Mark messages as read for current user on a specific job thread.
    Uses per-user read tracking: customer_last_read_at / provider_last_read_at
    Request body:
    - jobId: The service request ID for the thread
    """
    job_id = body.get("jobId")
    if not job_id:
        raise HTTPException(status_code=400, detail="jobId is required")

    request = await db.service_requests.find_one({"_id": ObjectId(job_id)})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    # Verify user is part of this request
    is_customer = request["customerId"] == current_user.id
    provider = await db.providers.find_one({"userId": current_user.id})
    is_provider = provider and str(provider["_id"]) == request.get("providerId")

    if not is_customer and not is_provider:
        raise HTTPException(status_code=403, detail="Not authorized")

    now = datetime.utcnow()

    # Update per-user last_read timestamp on the service request
    if is_customer:
        await db.service_requests.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"customer_last_read_at": now}}
        )
    else:
        await db.service_requests.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"provider_last_read_at": now}}
        )

    return {
        "success": True,
        "readAt": now.isoformat()
    }
