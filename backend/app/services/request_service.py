# backend/app/services/request_service.py
# Responsibility: All service request lifecycle business logic.
# Covers: create, list, detail, accept, decline, cancel, change provider,
# 24-hour timeout, excluded providers, status transitions.
# Status logic must live HERE or in utils/status.py — never duplicated.
# Phase 1: Structural shell only. server.py remains the active backend.

# Functions to be migrated from server.py in a future phase:
# create_request | get_requests | get_request_detail | accept_request
# decline_request | cancel_request | change_provider | handle_provider_timeout
