# backend/app/utils/status.py
# Responsibility: Single source of truth for all request status constants and transitions.
# Phase 2: Shared foundations. Exact copy of status logic from server.py.
# server.py retains its own copy until the switch-over is approved in a future phase.
# Status logic must exist in ONE place only — this file is that canonical location.

from typing import Optional

# =============================================================================
# VALID STATUS TRANSITIONS
# Exact copy of VALID_STATUS_TRANSITIONS from server.py.
# Defines the allowed lifecycle progression for service requests.
# =============================================================================
VALID_STATUS_TRANSITIONS: dict = {
    "pending": ["accepted"],
    "accepted": ["awaiting_payment"],        # quote sent
    "awaiting_payment": ["in_progress"],     # provider starts job (payment must be confirmed first)
    "in_progress": ["completed_pending_review"],  # provider completes with OTP
    "completed_pending_review": ["completed_reviewed"],  # customer submits or skips review
    "completed_reviewed": [],                # Terminal state — no further transitions
    # Legacy support — allow old "completed" status to be terminal
    "completed": ["completed_pending_review", "completed_reviewed"],
}


def validate_status_transition(current_status: str, new_status: str) -> tuple:
    """
    Validate if a status transition is allowed.
    Returns (is_valid: bool, error_message: str).
    Exact copy of validate_status_transition() from server.py.
    """
    if current_status == new_status:
        return True, ""  # No change is always valid

    allowed = VALID_STATUS_TRANSITIONS.get(current_status, [])
    if new_status in allowed:
        return True, ""

    return False, (
        f"Invalid status transition: '{current_status}' -> '{new_status}'. "
        f"Allowed: {allowed or 'none (terminal state)'}"
    )


def get_status_display_name(status: str) -> str:
    """
    Get human-readable status name.
    Exact copy of get_status_display_name() from server.py.
    """
    names = {
        "pending": "Pending",
        "accepted": "Accepted",
        "awaiting_payment": "Awaiting Payment",
        "in_progress": "In Progress",
        "completed_pending_review": "Pending Review",
        "completed_reviewed": "Completed",
        "completed": "Completed",  # Legacy support
    }
    return names.get(status, status.title())


def normalize_legacy_job(job: dict) -> dict:
    """
    Normalize legacy job data to current state machine.
    Exact copy of normalize_legacy_job() from server.py.
    Ensures all job documents have the required fields for current logic.
    """
    if "status" not in job:
        job["status"] = "pending"

    if "paymentStatus" not in job:
        job["paymentStatus"] = "unpaid"

    return job
