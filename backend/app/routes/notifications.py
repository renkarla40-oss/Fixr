# backend/app/routes/notifications.py
# Responsibility: API endpoints for the notification center (bell notifications).
# Phase 9: register_push_token, get_notifications, get_unread_count,
#          mark_notification_read, mark_all_notifications_read migrated from server.py.
# Note: HTTP methods match server.py exactly (PATCH for mark read).
# Notification unread is separate from chat unread and request event unread.
# No business logic in this file — thin wrappers only.

from fastapi import APIRouter, Depends, Query
from app.dependencies import get_current_user
from app.database import get_db
from app.services import notification_service
from app.schemas.notification import RegisterPushTokenRequest

router = APIRouter(
    prefix="/notifications",
    tags=["notifications"],
)


@router.post("/register-token")
async def register_push_token(
    request_data: RegisterPushTokenRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await notification_service.register_push_token(
        request_data=request_data,
        current_user=current_user,
        db=db,
    )


@router.get("")
async def get_notifications(
    current_user=Depends(get_current_user),
    db=Depends(get_db),
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    unread_only: bool = Query(False),
):
    return await notification_service.get_notifications(
        current_user=current_user,
        db=db,
        limit=limit,
        skip=skip,
        unread_only=unread_only,
    )


@router.get("/unread-count")
async def get_unread_count(
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await notification_service.get_unread_count(
        current_user=current_user,
        db=db,
    )


@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await notification_service.mark_notification_read(
        notification_id=notification_id,
        current_user=current_user,
        db=db,
    )


@router.patch("/read-all")
async def mark_all_notifications_read(
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await notification_service.mark_all_notifications_read(
        current_user=current_user,
        db=db,
    )
