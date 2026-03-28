# backend/app/utils/status.py
# Responsibility: Single source of truth for all request status constants and transitions.
# Status logic must exist in ONE place only: here OR request_service.py — never both.
# Phase 1: Structural shell only. server.py remains the active backend.

# Status constants and transition rules to be defined in a future phase.
# Example statuses: pending, matched, accepted, in_progress, completed, cancelled, expired
