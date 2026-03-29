# backend/app/schemas/review.py
# Responsibility: Pydantic request/response schemas for Review endpoints.
# Phase 9: SubmitReviewRequest, ReviewCreate, Review migrated from server.py.

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class SubmitReviewRequest(BaseModel):
    rating: int  # 1-5 stars
    review: Optional[str] = None  # Optional review text (max 500 chars)


class ReviewCreate(BaseModel):
    """Request body for creating a review"""
    jobId: str
    rating: int = Field(..., ge=1, le=5, description="Rating 1-5 stars")
    comment: Optional[str] = Field(None, max_length=500, description="Optional review text")


class Review(BaseModel):
    """Review model - one review per completed job"""
    id: str = Field(alias="_id")
    jobId: str  # Unique - only one review per job
    providerId: str
    customerId: str
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
