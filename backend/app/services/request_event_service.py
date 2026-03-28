# backend/app/services/request_event_service.py
# Responsibility: Business logic for system-generated Request Events ONLY.
# Request events are system-generated lifecycle updates (e.g. status changes,
# provider assigned, quote sent, payment received, job started, job completed).
# Human chat messages belong in message_service.py — NOT here.
# Request event unread state is SEPARATE from chat unread and notification unread.
# Phase 1 shell (created in Phase 3.5 structural integrity fix).
# Phase 1: No logic, no functions. server.py remains the active backend.

# Functions to be defined in a future phase:
# - create_event(request_id, event_type, triggered_by)
# - get_events(request_id)
# - mark_events_seen(request_id, role)
