# backend/app/schemas/user.py
# Responsibility: Pydantic request/response schemas for User entity.
# Shared user shapes used across customer and provider flows.
# Phase 1: Structural shell only. server.py remains the active backend.

from pydantic import BaseModel

# Schemas to be defined in a future phase:
# UserBase, UserResponse, UserUpdate
