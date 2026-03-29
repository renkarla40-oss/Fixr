# backend/app/routes/reviews.py
# Responsibility: API endpoints for customer reviews after job completion.
# Phase 9: create_review, get_review_by_job, get_reviews_by_provider migrated from server.py.
# Routes: POST /reviews, GET /reviews/by-job/{job_id}, GET /reviews/by-provider/{provider_id}
# send_push_notification injected at route layer for create_review.
# No business logic in this file — thin wrappers only.

from fastapi import APIRouter, Depends, Query
from server import send_push_notification
from app.dependencies import get_current_user
from app.database import get_db
from app.services import review_service
from app.schemas.review import ReviewCreate, Review

router = APIRouter(
    prefix="/reviews",
    tags=["reviews"],
)


@router.post("", response_model=Review)
async def create_review(
    review_data: ReviewCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await review_service.create_review(
        review_data=review_data,
        current_user=current_user,
        db=db,
        notify_fn=send_push_notification,
    )


@router.get("/by-job/{job_id}")
async def get_review_by_job(
    job_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await review_service.get_review_by_job(
        job_id=job_id,
        current_user=current_user,
        db=db,
    )


@router.get("/by-provider/{provider_id}")
async def get_reviews_by_provider(
    provider_id: str,
    limit: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    return await review_service.get_reviews_by_provider(
        provider_id=provider_id,
        current_user=current_user,
        db=db,
        limit=limit,
    )
