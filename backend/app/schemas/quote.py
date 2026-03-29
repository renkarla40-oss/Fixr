# backend/app/schemas/quote.py
# Responsibility: Pydantic schemas for Quote endpoints.
# Phase 5: Exact copies of quote-related structures from server.py.
# server.py retains its own copies until decommissioned in Phase 10.

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class QuoteCreate(BaseModel):
    """Request body for creating a quote. Matches server.py create_quote() input."""
    requestId: str
    amount: float
    title: Optional[str] = "Service Quote"
    description: Optional[str] = ""
    currency: Optional[str] = "TTD"
    note: Optional[str] = ""


class QuoteRevise(BaseModel):
    """Request body for revising a quote. Matches server.py revise_quote() input."""
    amount: Optional[float] = None
    note: Optional[str] = None


class QuoteCounter(BaseModel):
    """Request body for countering a quote. Matches server.py counter_quote() input."""
    counterAmount: float
    counterNote: Optional[str] = ""
