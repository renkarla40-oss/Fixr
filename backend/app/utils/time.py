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
    """
    return datetime.utcnow() + timedelta(hours=hours)
