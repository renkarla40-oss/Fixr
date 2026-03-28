# backend/app/schemas/message.py
# Responsibility: Pydantic request/response schemas for human chat Message endpoints.
# HUMAN CHAT MESSAGES ONLY — system events belong in request_event.py.
# Phase 1: Structural shell only. server.py remains the active backend.

from pydantic import BaseModel

# Schemas to be defined in a future phase:
# MessageCreate, MessageResponse
