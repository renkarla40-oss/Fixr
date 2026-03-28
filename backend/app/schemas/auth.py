# backend/app/schemas/auth.py
# Responsibility: Pydantic request/response schemas for authentication endpoints.
# Handles OTP request, OTP verify, token refresh, and login/logout shapes.
# Phase 1: Structural shell only. server.py remains the active backend.

from pydantic import BaseModel

# Schemas to be defined in a future phase:
# OTPRequest, OTPVerify, TokenResponse, RefreshRequest
