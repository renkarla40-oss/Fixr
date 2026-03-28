# backend/app/services/message_service.py
# Responsibility: Business logic for human chat messages ONLY.
# This service handles customer-provider chat messages.
# System-generated request updates belong in request_event_service.py — NOT here.
# Phase 1 shell (created in Phase 3.5 structural integrity fix).
# Phase 1: No logic, no functions. server.py remains the active backend.

# Functions to be defined in a future phase:
# - send_message(request_id, sender_id, sender_role, body)
# - get_messages(request_id)
# - mark_messages_read(request_id, reader_role)
