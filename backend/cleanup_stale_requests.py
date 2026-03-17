"""
cleanup_stale_requests.py
==========================
Identifies and removes stale service requests from the Fixr MongoDB database.

WHAT IT TARGETS (three categories):
  1. Demo requests — description contains "CHAT TEST" (created by reset_demo_data())
  2. Orphaned-provider requests — providerId is set but the provider document
     no longer exists in the providers collection
  3. Stale general requests — isGeneralRequest=True with a status that means
     they are resolved (accepted / declined / cancelled / completed / in_progress)
     but still broadcast to all providers via the old query

USAGE:
    # Dry run — prints what would be deleted, nothing is touched:
    python backend/cleanup_stale_requests.py --dry-run

    # Interactive run — shows counts, prompts before deleting:
    python backend/cleanup_stale_requests.py

    # Skip confirmation prompt (for scripted use):
    python backend/cleanup_stale_requests.py --yes

SAFETY:
  - Always shows a summary before deleting
  - Interactive mode requires you to type "yes" to confirm
  - Dry run never writes anything
  - Only the three categories above are targeted — live pending jobs are safe
"""

import asyncio
import sys
import os
from pathlib import Path
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from dotenv import load_dotenv

# ── Config ────────────────────────────────────────────────────────────────────
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME   = os.environ["DB_NAME"]

DRY_RUN   = "--dry-run" in sys.argv
AUTO_YES  = "--yes" in sys.argv

# Statuses that mean a general request is resolved and should not broadcast
RESOLVED_STATUSES = {
    "accepted",
    "awaiting_payment",
    "in_progress",
    "completed",
    "completed_pending_review",
    "completed_reviewed",
    "declined",
    "cancelled",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def fmt(doc: dict) -> str:
    """One-line summary of a request document."""
    rid     = str(doc.get("_id", "?"))
    status  = doc.get("status", "?")
    service = doc.get("service", "?")
    desc    = (doc.get("description") or "")[:60]
    created = doc.get("createdAt")
    created_str = created.strftime("%Y-%m-%d %H:%M") if created else "unknown date"
    return f"  [{rid}] {service} | {status} | {created_str} | {desc!r}"


async def run() -> None:
    client = AsyncIOMotorClient(MONGO_URL)
    db     = client[DB_NAME]

    print(f"\nFixr stale request cleaner")
    print(f"Database : {DB_NAME}")
    print(f"Mode     : {'DRY RUN — nothing will be deleted' if DRY_RUN else 'INTERACTIVE'}")
    print("=" * 66)

    # ── Category 1: Demo / CHAT TEST requests ─────────────────────────────────
    demo_docs = await db.service_requests.find(
        {"description": {"$regex": "CHAT TEST", "$options": "i"}}
    ).to_list(None)

    print(f"\n[Category 1] Demo requests containing 'CHAT TEST': {len(demo_docs)}")
    for doc in demo_docs:
        print(fmt(doc))

    # ── Category 2: Orphaned-provider requests ────────────────────────────────
    # Requests where providerId is set but no matching provider document exists
    all_assigned = await db.service_requests.find(
        {"providerId": {"$ne": None, "$exists": True}}
    ).to_list(None)

    orphaned_docs = []
    for req in all_assigned:
        pid = req.get("providerId")
        if not pid:
            continue
        try:
            provider = await db.providers.find_one({"_id": ObjectId(pid)})
            if not provider:
                orphaned_docs.append(req)
        except Exception:
            # Invalid ObjectId format — provider reference is broken
            orphaned_docs.append(req)

    print(f"\n[Category 2] Orphaned-provider requests (providerId points to missing provider): {len(orphaned_docs)}")
    for doc in orphaned_docs:
        print(fmt(doc))

    # ── Category 3: Resolved general requests that still broadcast ────────────
    stale_general_docs = await db.service_requests.find({
        "isGeneralRequest": True,
        "status": {"$in": list(RESOLVED_STATUSES)},
    }).to_list(None)

    print(f"\n[Category 3] Stale general requests (resolved but still broadcasting): {len(stale_general_docs)}")
    for doc in stale_general_docs:
        print(fmt(doc))

    # ── Deduplicate (a doc can fall into multiple categories) ─────────────────
    all_ids: set = set()
    for doc in demo_docs + orphaned_docs + stale_general_docs:
        all_ids.add(doc["_id"])

    total = len(all_ids)

    print("\n" + "=" * 66)
    print(f"Total unique requests targeted for deletion: {total}")

    if total == 0:
        print("Nothing to clean up. Exiting.\n")
        client.close()
        return

    if DRY_RUN:
        print("Dry run — no changes made.\n")
        client.close()
        return

    # ── Confirmation ──────────────────────────────────────────────────────────
    if not AUTO_YES:
        print()
        answer = input(f"Delete {total} request(s)? Type 'yes' to confirm: ").strip().lower()
        if answer != "yes":
            print("Aborted — no changes made.\n")
            client.close()
            return

    # ── Delete ────────────────────────────────────────────────────────────────
    object_ids = list(all_ids)

    # Delete the requests
    result = await db.service_requests.delete_many({"_id": {"$in": object_ids}})
    deleted_requests = result.deleted_count

    # Delete associated messages to avoid orphaned chat threads
    id_strings = [str(oid) for oid in object_ids]
    msg_result = await db.job_messages.delete_many({"requestId": {"$in": id_strings}})
    deleted_messages = msg_result.deleted_count

    # Delete associated notifications
    notif_result = await db.notifications.delete_many(
        {"data.requestId": {"$in": id_strings}}
    )
    deleted_notifs = notif_result.deleted_count

    print(f"\n✅  Deleted {deleted_requests} service request(s)")
    print(f"    Deleted {deleted_messages} associated message(s)")
    print(f"    Deleted {deleted_notifs} associated notification(s)")
    print("\nCleanup complete.\n")

    client.close()


if __name__ == "__main__":
    asyncio.run(run())
