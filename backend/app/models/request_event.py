# backend/app/models/request_event.py
# Responsibility: Database model for system-generated Request Event entity ONLY.
# Human chat messages belong in message.py — NOT here.
# Request events = system-generated lifecycle updates (status changes, assignments, etc.)
# Phase 1: Structural shell only. server.py remains the active backend.

# Fields to be defined in a future phase:
# id, request_id, event_type, triggered_by, is_seen_by_customer, is_seen_by_provider, created_at
