# backend/app/schemas/notification.py
# Responsibility: Pydantic request/response schemas for Notification endpoints.
# Phase 9: RegisterPushTokenRequest migrated from server.py.

from pydantic import BaseModel


class RegisterPushTokenRequest(BaseModel):
    expoPushToken: str
