# backend/app/utils/validators.py
# Responsibility: Shared input validation helpers.
# Phase 2: Shared foundations. server.py remains the active backend.
# Consistent with validation patterns used inline throughout server.py.
# Not yet imported by anything active — dormant until Phase 3+.

import re
from typing import Union


def validate_phone_number(phone: str) -> bool:
    """
    Validate that a phone number is a non-empty string of reasonable length.
    Consistent with server.py OTP phone handling (accepts raw string, no strict format).
    Returns True if valid, False otherwise.
    """
    if not phone or not isinstance(phone, str):
        return False
    # Strip whitespace and check for digits-only content (with optional + prefix)
    stripped = phone.strip()
    if len(stripped) < 7 or len(stripped) > 20:
        return False
    return bool(re.match(r"^[+]?[0-9\s\-().]{7,20}$", stripped))


def validate_rating(rating: Union[int, float]) -> bool:
    """
    Validate that a rating is an integer between 1 and 5 inclusive.
    Consistent with server.py SubmitReviewRequest: rating: int (1-5 stars).
    Returns True if valid, False otherwise.
    """
    try:
        r = int(rating)
        return 1 <= r <= 5
    except (TypeError, ValueError):
        return False


def validate_price(amount) -> float:
    """
    Validate and coerce a price/amount value.
    Consistent with server.py quote validation: amount must be numeric and > 0.
    Returns the float value if valid.
    Raises ValueError if invalid.
    """
    try:
        value = float(amount)
    except (TypeError, ValueError):
        raise ValueError("Invalid amount: must be a numeric value")
    if value <= 0:
        raise ValueError("Amount must be greater than 0")
    return value
