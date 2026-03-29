# backend/app/schemas/service_request.py
# Responsibility: Pydantic request/response schemas for Service Request endpoints.
# Phase 4: Exact copies of ServiceRequest, ServiceRequestResponse, AssignProviderRequest
# from server.py (lines 280-340, 1896).
# server.py retains its own copies until it is decommissioned in Phase 10.

from pydantic import BaseModel, Field, field_serializer
from typing import Optional
from datetime import datetime


class ServiceRequest(BaseModel):
    service: str
    description: str
    preferredDateTime: Optional[datetime] = None
    subCategory: Optional[str] = None  # For handyman sub-categories
    location: Optional[str] = None  # Customer's service location (legacy)
    jobTown: Optional[str] = None  # New: specific job town
    searchDistanceKm: int = 16  # Customer's search distance in km (default ~10 mi)
    searchRadiusMiles: Optional[int] = None  # Legacy support
    jobDuration: Optional[str] = None  # New: estimated job duration


class ServiceRequestResponse(BaseModel):
    id: str = Field(alias="_id")
    customerId: str
    providerId: Optional[str] = None  # Can be None for general requests
    service: str
    description: str
    preferredDateTime: Optional[datetime] = None
    status: str = "pending"  # pending, accepted, declined, in_progress, completed, cancelled
    customerName: str
    customerPhone: Optional[str] = None  # Made optional for legacy records
    providerName: Optional[str] = None  # Can be None for general requests
    isGeneralRequest: bool = False  # Flag for "Other Services" requests
    subCategory: Optional[str] = None  # For handyman sub-categories
    location: Optional[str] = None  # Customer's service location (legacy)
    jobTown: Optional[str] = None  # New: specific job town
    searchRadiusMiles: int = 10  # Customer's search radius
    jobDuration: Optional[str] = None  # Estimated job duration
    createdAt: datetime
    # Lifecycle timestamps
    acceptedAt: Optional[datetime] = None  # When provider accepted
    startedAt: Optional[datetime] = None  # When job started (in_progress)
    completedAt: Optional[datetime] = None  # When job completed
    cancelledAt: Optional[datetime] = None  # When cancelled
    cancelledBy: Optional[str] = None  # "customer" or "provider"
    declinedAt: Optional[datetime] = None  # When provider declined
    # Job confirmation code
    jobCode: Optional[str] = None  # 6-digit code for job start confirmation
    # Review fields
    customerReview: Optional[str] = None  # Customer's review text (max 500 chars)
    customerRating: Optional[int] = None  # 1-5 stars
    reviewedAt: Optional[datetime] = None
    # Per-user read tracking (for unread indicators)
    customer_last_read_at: Optional[datetime] = None
    provider_last_read_at: Optional[datetime] = None
    last_message_at: Optional[datetime] = None  # Timestamp of most recent message

    class Config:
        populate_by_name = True

    # FIX: Pydantic v2 datetime serializer - ensures UTC timestamps include 'Z' suffix
    # Without this, naive datetime objects are serialized without timezone info,
    # causing frontend to interpret them as local time (wrong by ~5 hours)
    @field_serializer('createdAt', 'preferredDateTime', 'acceptedAt', 'startedAt',
                      'completedAt', 'cancelledAt', 'declinedAt', 'reviewedAt',
                      'customer_last_read_at', 'provider_last_read_at', 'last_message_at')
    def serialize_datetime(self, value: Optional[datetime]) -> Optional[str]:
        if value is None:
            return None
        # Ensure UTC suffix is included for proper frontend parsing
        return value.isoformat() + 'Z'


class AssignProviderRequest(BaseModel):
    providerId: str
