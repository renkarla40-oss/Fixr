# backend/app/utils/time.py
# Responsibility: Shared time/datetime utility helpers.
# Phase 2: Shared foundations. server.py remains the active backend.
# These are new stateless helpers consistent with server.py datetime usage patterns.
# Not yet imported by anything active — dormant until Phase 3+.

from datetime import datetime, timedelta


def utcnow() -> datetime:
    """
    Return the current UTC datetime.
    Consistent with server.py usage of datetime.utcnow() throughout.
    """
    return datetime.utcnow()


def is_expired(dt: datetime) -> bool:
    """
    Return True if the given datetime is in the past (i.e., has expired).
    Used for OTP expiry checks and provider timeout checks.
    """
    return datetime.utcnow() > dt


def otp_expiry(minutes: int = 10) -> datetime:
    """
    Return a datetime representing when an OTP expires.
    Default: 10 minutes from now.
    Consistent with server.py OTP TTL pattern.
    """
    return datetime.utcnow() + timedelta(minutes=minutes)


def provider_response_deadline(hours: int = 24) -> datetime:
    """
    Return a datetime representing the provider 24-hour response deadline.
    Consistent with the protected 24-hour provider response window in FIXR_PRODUCT_FLOW.md.
#
    # AUDIT NOTE (Phase 3.5):
    # This function was introduced in Phase 2 but was NOT listed in the approved Phase 2 plan.
    # It was flagged in the pre-Phase 4 audit report.
    # It was accepted and approved post-audit per user instruction in Phase 3.5.
    # It is currently dormant — not imported by any active module.
    # server.py handles the 24-hour timeout inline using timedelta(hours=24) directly.
    """
    return datetime.utcnow() + timedelta(hours=hours)
