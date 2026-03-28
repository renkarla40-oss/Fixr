# backend/app/schemas/notification.py
# Responsibility: Pydantic request/response schemas for Notification endpoints.
# Notification unread count is SEPARATE from chat unread and request event unread.
# Phase 1: Structural shell only. server.py remains the active backend.

from pydantic import BaseModel

# Schemas to be defined in a future phase:
# NotificationResponse, NotificationMarkRead
