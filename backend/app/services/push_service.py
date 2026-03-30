# backend/app/services/push_service.py
# Responsibility: Push notification and in-app notification creation.
# Phase 10 fix: Exact extraction of create_notification + send_push_notification
# from server.py. Uses app.database.db instead of server.py module-level db.
# This allows route files to import send_push_notification without importing server.py.

import httpx
import logging
from bson import ObjectId
from datetime import datetime

from app.database import db

logger = logging.getLogger(__name__)


async def create_notification(
    user_id: str,
    notification_type: str,
    title: str,
    body: str,
    job_id: str = None,
    provider_id: str = None,
    customer_id: str = None,
    data: dict = None,
    idempotency_key: str = None
):
    """
    Create an in-app notification with idempotency support.
    If idempotency_key is provided, checks for existing notification to prevent duplicates.
    Exact copy from server.py.
    """
    try:
        # Idempotency check - prevent duplicate notifications for same event
        if idempotency_key:
            existing = await db.notifications.find_one({
                "userId": user_id,
                "data.idempotencyKey": idempotency_key
            })
            if existing:
                logger.debug(f"Notification already exists for key: {idempotency_key}")
                return existing

        notification_doc = {
            "userId": user_id,
            "type": notification_type,
            "title": title,
            "body": body,
            "data": {**(data or {}), "idempotencyKey": idempotency_key} if idempotency_key else (data or {}),
            "jobId": job_id,
            "providerId": provider_id,
            "customerId": customer_id,
            "isRead": False,
            "read": False,
            "createdAt": datetime.utcnow(),
            "readAt": None,
        }

        result = await db.notifications.insert_one(notification_doc)
        notification_doc["_id"] = str(result.inserted_id)
        logger.debug(f"Created notification {notification_type} for user {user_id}")
        return notification_doc
    except Exception as e:
        logger.error(f"Error creating notification: {e}")
        return None

async def send_push_notification(user_id: str, title: str, body: str, data: dict = None):
    """Send push notification to a user and create in-app notification.
    Exact copy from server.py.
    """
    try:
        # Extract job/provider/customer IDs from data if available
        job_id = data.get("requestId") or data.get("jobId") if data else None
        provider_id = data.get("providerId") if data else None
        customer_id = data.get("customerId") if data else None
        notification_type = data.get("type", "general") if data else "general"

        # Create idempotency key from type + jobId + userId
        idempotency_key = f"{notification_type}:{job_id}:{user_id}" if job_id else None

        # Create in-app notification with idempotency
        await create_notification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            body=body,
            job_id=job_id,
            provider_id=provider_id,
            customer_id=customer_id,
            data=data,
            idempotency_key=idempotency_key
        )

        # Get user's push token
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user or not user.get("expoPushToken"):
            return  # No push token, only in-app notification created

        push_token = user["expoPushToken"]

        # Send via Expo Push API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json={
                    "to": push_token,
                    "title": title,
                    "body": body,
                    "data": data or {},
                    "sound": "default",
                },
                headers={"Content-Type": "application/json"},
            )
            if response.status_code != 200:
                logger.warning(f"Push notification failed: {response.text}")
    except Exception as e:
        logger.error(f"Error sending notification: {e}")
