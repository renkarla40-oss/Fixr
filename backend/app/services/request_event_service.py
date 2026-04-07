# backend/app/services/request_event_service.py
# Responsibility: Business logic for system-generated Request Events ONLY.
# Request events are system-generated lifecycle updates (e.g. status changes,
# provider assigned, quote sent, payment received, job started, job completed).
# Human chat messages belong in message_service.py — NOT here.
# Request event unread state is SEPARATE from chat unread and notification unread.
# Phase 11: log_event and get_events implemented. Writes to activity_events collection.

from datetime import datetime
import logging

logger = logging.getLogger(__name__)


async def log_event(db, request_id: str, event_type: str, actor_role: str, payload: dict):
      """
          Write a system/lifecycle event to the activity_events collection.
              Called in place of job_messages.insert_one for all system-generated events.
                  """
      event = {
          "requestId": request_id,
          "event_type": event_type,
          "actor_role": actor_role,
          "payload": payload,
          "createdAt": datetime.utcnow(),
      }
      await db.activity_events.insert_one(event)
      logger.info(f"[ActivityEvent] event_type={event_type} actor_role={actor_role} requestId={request_id}")


async def get_events(db, request_id: str) -> list:
      """
          Fetch all activity events for a given request, sorted oldest-first.
              """
      events = await db.activity_events.find(
          {"requestId": request_id}
      ).sort("createdAt", 1).to_list(500)
      for e in events:
          e["_id"] = str(e["_id"])
      return events
