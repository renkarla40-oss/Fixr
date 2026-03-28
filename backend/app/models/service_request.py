# backend/app/models/service_request.py
# Responsibility: Database model for the Service Request entity.
# Statuses: pending, accepted, awaiting_payment, in_progress,
# completed_pending_review, completed, declined, cancelled.
# Payment statuses: unpaid, held, released, refunded.
# Phase 1: Structural shell only. server.py remains the active backend.

# Fields to be defined in a future phase:
# id, customer_id, provider_id, service_category, subcategory, description,
# status, payment_status, excluded_providers, created_at, updated_at, provider_response_deadline
