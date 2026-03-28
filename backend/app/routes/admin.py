# backend/app/routes/admin.py
# Responsibility: API endpoints for admin-only actions.
# Phase 1: Stub router only. server.py remains the active backend.

from fastapi import APIRouter

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
)

 # GET /admin/users | GET /admin/requests | POST /admin/providers/{id}/approve
