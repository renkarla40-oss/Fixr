# backend/app/models/notification.py
# Responsibility: Database model for the Notification entity.
# Notifications are push/in-app alerts sent to users.
# Notification unread count is SEPARATE from chat unread and request event unread.
# Phase 1: Structural shell only. server.py remains the active backend.

# Fields to be defined in a future phase:
# id, user_id, type, title, body, is_read, related_request_id, created_at
