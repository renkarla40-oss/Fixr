# backend/app/schemas/otp.py
# Responsibility: Pydantic request/response schemas for OTP endpoints.
# Phase 8: Job execution schemas migrated from server.py. server.py remains the active backend.
# ConfirmJobStartRequest is an exact copy from server.py L274-275.
# completion_data uses raw dict in server.py — no schema created for it.

from pydantic import BaseModel


class ConfirmJobStartRequest(BaseModel):
    jobCode: str  # 6-digit code from customer
