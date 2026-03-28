# backend/app/routes/otp.py
# Responsibility: API endpoints for OTP verification.
# Start OTP and completion OTP are separate — both are protected behaviors.
# Phase 1: Stub router only. server.py remains the active backend.

from fastapi import APIRouter

router = APIRouter(
    prefix="/otp",
    tags=["otp"],
)

 # POST /otp/generate-start | POST /otp/verify-start
# POST /otp/generate-completion | POST /otp/verify-completion
