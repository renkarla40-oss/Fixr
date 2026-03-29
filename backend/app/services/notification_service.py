# backend/app/services/notification_service.py
# Responsibility: Notification center business logic (bell notifications).
# Phase 9: register_push_token, get_notifications, get_unread_count,
#          mark_notification_read, mark_all_notifications_read migrated from server.py.
# Note: create_notification and send_push_notification remain in server.py.
# Notification unread is separate from chat unread and request event unread.

from bson import ObjectId
from datetime import datetime


async def register_push_token(request_data, current_user, db):
    """Register user's Expo push token for push notifications"""
    await db.users.update_one(
        {"_id": ObjectId(current_user.id)},
        {"$set": {"expoPushToken": request_data.expoPushToken}}
    )
    return {"success": True, "message": "Push token registered"}


async def get_notifications(current_user, db, limit=50, skip=0, unread_only=False):
    """Get user's notifications with pagination (newest first)"""
    query = {"userId": current_user.id}
    if unread_only:
        query["isRead"] = False

    total_count = await db.notifications.count_documents(query)

    notifications = await db.notifications.find(query).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)

    for n in notifications:
        n["_id"] = str(n["_id"])
        # Ensure backward compatibility - map old 'read' field to 'isRead'
        if "read" in n and "isRead" not in n:
            n["isRead"] = n.pop("read")

    return {
        "notifications": notifications,
        "total": total_count,
        "hasMore": skip + len(notifications) < total_count
    }


async def get_unread_count(current_user, db):
    """Get count of unread notifications"""
    # Support both old 'read' field and new 'isRead' field
    count = await db.notifications.count_documents({
        "userId": current_user.id,
        "$or": [
            {"isRead": False},
            {"read": False, "isRead": {"$exists": False}}
        ]
    })
    return {"unreadCount": count}


async def mark_notification_read(notification_id: str, current_user, db):
    """Mark a notification as read"""
    now = datetime.utcnow()
    result = await db.notifications.update_one(
        {"_id": ObjectId(notification_id), "userId": current_user.id},
        {"$set": {"isRead": True, "read": True, "readAt": now}}
    )
    if result.matched_count == 0:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True, "readAt": now.isoformat()}


async def mark_all_notifications_read(current_user, db):
    """Mark all notifications as read"""
    now = datetime.utcnow()
    result = await db.notifications.update_many(
        {"userId": current_user.id, "$or": [{"isRead": False}, {"read": False}]},
        {"$set": {"isRead": True, "read": True, "readAt": now}}
    )
    return {"success": True, "markedCount": result.modified_count}
