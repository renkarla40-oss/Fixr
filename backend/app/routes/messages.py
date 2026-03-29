# backend/app/routes/messages.py
# Responsibility: API endpoints for human chat messages.
# Phase 6: Route handlers wired to message_service business logic.
# No business logic lives in this file — handlers are thin wrappers only.
# NO prefix on this router — all paths are declared explicitly in full.
# Paths match server.py exactly:
#   GET  /service-requests/{request_id}/messages
#   POST /service-requests/{request_id}/messages
#   PATCH /service-requests/{request_id}/messages/seen
#   POST /messages/mark-read
# upload_chat_image and get_chat_image are NOT migrated (filesystem dependency).
# server.py remains the active backend throughout Phase 6.

from fastapi import APIRouter, Depends
from typing import Optional

from server import send_push_notification
from app.dependencies import get_current_user
from app.database import get_db
from app.services import message_service

# NO prefix — all paths declared explicitly to match server.py exactly
router = APIRouter(
    tags=["messages"],
)


@router.get("/service-requests/{request_id}/messages")
async def get_job_messages(
    request_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await message_service.get_job_messages(
        request_id=request_id,
        current_user=current_user,
        db=db,
    )


@router.post("/service-requests/{request_id}/messages")
async def send_job_message(
    request_id: str,
    message: dict,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await message_service.send_job_message(
        request_id=request_id,
        message=message,
        current_user=current_user,
        db=db,
        notify_fn=send_push_notification,
    )


@router.patch("/service-requests/{request_id}/messages/seen")
async def mark_messages_as_seen(
    request_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await message_service.mark_messages_as_seen(
        request_id=request_id,
        current_user=current_user,
        db=db,
    )


@router.post("/messages/mark-read")
async def mark_messages_read(
    body: dict,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await message_service.mark_messages_read(
        body=body,
        current_user=current_user,
        db=db,
    )
