"""
apply_patch.py
==============
Patches backend/server.py with three targeted fixes for the Fixr backend.

FIXES APPLIED:
  Fix 1 — Defensive defaults in get_providers() loop so a single malformed
           provider document cannot crash the entire Provider Directory.
  Fix 2 — Tighten the provider job query in get_service_requests() so
           general requests only broadcast when pending AND unassigned.
  Fix 3 — Insert a symmetric provider-side system message when a provider
           accepts a job (mirrors the existing customer-side message).

USAGE:
    # From Fixr project root:
    python backend/apply_patch.py

    # Dry run — shows what would change without writing:
    python backend/apply_patch.py --check

A backup is written to backend/server.py.bak before any modification.
If any patch fails to apply, the backup is automatically restored.
"""

import sys
import shutil
from pathlib import Path

# ── Config ───────────────────────────────────────────────────────────────────
# Works whether run from the Fixr project root OR from backend/ directly.
_THIS_DIR   = Path(__file__).parent
SERVER_PATH = _THIS_DIR / "server.py"
BACKUP_PATH = _THIS_DIR / "server.py.bak"
DRY_RUN     = "--check" in sys.argv


# ── Patches ───────────────────────────────────────────────────────────────────
# Each entry: (description, old_text, new_text)
# old_text is verified against the live file on fixr-build-prep.
# Each old_text appears exactly once in server.py.

PATCHES = [

    # =========================================================================
    # Fix 1 — Defensive defaults in get_providers() loop
    # =========================================================================
    # Problem: Provider(**provider) raises a Pydantic ValidationError if any
    # required field (userId, name, phone, services, bio, verificationStatus,
    # setupComplete) is missing from a document. FastAPI catches this as an
    # unhandled exception and returns HTTP 500 for the ENTIRE directory.
    #
    # Fix: wrap the Pydantic call in try/except and add .setdefault() guards
    # for all required fields, so one bad document is skipped, not fatal.
    #
    # Insertion point: the line `result.append(Provider(**provider))` inside
    # get_providers(), followed by the closing `return result`.
    # =========================================================================
    (
        "Fix 1 — Defensive defaults in get_providers() (prevent ValidationError crash)",

        # ── OLD (exact from live file) ────────────────────────────────────────
        "        result.append(Provider(**provider))\n"
        "    \n"
        "    return result\n"
        "\n"
        "# Endpoint to get list of available town",

        # ── NEW ───────────────────────────────────────────────────────────────
        "        # Fix 1: Defensive defaults — guard all Pydantic-required fields.\n"
        "        # A single malformed document must NOT crash the whole directory.\n"
        "        provider.setdefault(\"userId\", \"\")\n"
        "        provider.setdefault(\"name\", \"Unknown Provider\")\n"
        "        provider.setdefault(\"phone\", \"\")\n"
        "        provider.setdefault(\"services\", [])\n"
        "        provider.setdefault(\"bio\", \"\")\n"
        "        provider.setdefault(\"verificationStatus\", \"pending\")\n"
        "        provider.setdefault(\"setupComplete\", False)\n"
        "        provider.setdefault(\"travelDistanceKm\", 16)\n"
        "        provider.setdefault(\"travelAnywhere\", False)\n"
        "        provider.setdefault(\"completedJobsCount\", 0)\n"
        "        provider.setdefault(\"averageRating\", None)\n"
        "        provider.setdefault(\"totalReviews\", 0)\n"
        "        provider.setdefault(\"phoneVerified\", False)\n"
        "        provider.setdefault(\"uploadsComplete\", False)\n"
        "        provider.setdefault(\"riskFlags\", [])\n"
        "        provider.setdefault(\"isOutsideSelectedArea\", False)\n"
        "        try:\n"
        "            result.append(Provider(**provider))\n"
        "        except Exception as _err:\n"
        "            logger.warning(\n"
        "                f\"get_providers: skipping malformed provider \"\n"
        "                f\"{provider.get('_id')} — {_err}\"\n"
        "            )\n"
        "    \n"
        "    return result\n"
        "\n"
        "# Endpoint to get list of available town",
    ),

    # =========================================================================
    # Fix 2 — Tighten general-request fan-out in get_service_requests()
    # =========================================================================
    # Problem: the query {"isGeneralRequest": True} matches every general
    # request ever created — completed jobs, demo data created by
    # reset_demo_data(), and resolved requests — flooding the provider's list.
    #
    # Fix: add status="pending" and providerId=None so only genuinely open,
    # unassigned requests broadcast to all providers.
    # =========================================================================
    (
        "Fix 2 — Tighten general-request fan-out to pending + unassigned only",

        # ── OLD (exact from live file) ────────────────────────────────────────
        "        # Providers see their specific requests AND all general \"other services\" requests\n"
        "        query = {\n"
        "            \"$or\": [\n"
        "                {\"providerId\": str(provider[\"_id\"])},  # Requests specifically for this provider\n"
        "                {\"isGeneralRequest\": True}  # General requests visible to all providers\n"
        "            ]\n"
        "        }",

        # ── NEW ───────────────────────────────────────────────────────────────
        "        # Fix 2: Providers see their own requests + ONLY unassigned pending general requests.\n"
        "        # Restricting to status=pending + providerId=None prevents old/completed/demo\n"
        "        # general requests from appearing in every provider's job list.\n"
        "        query = {\n"
        "            \"$or\": [\n"
        "                {\"providerId\": str(provider[\"_id\"])},  # Requests specifically for this provider\n"
        "                {                                       # General requests: pending + unassigned only\n"
        "                    \"isGeneralRequest\": True,\n"
        "                    \"status\": \"pending\",\n"
        "                    \"providerId\": None,\n"
        "                },\n"
        "            ]\n"
        "        }",
    ),

    # =========================================================================
    # Fix 3 — Provider-side system message on job acceptance
    # =========================================================================
    # Problem: accept_service_request() inserts a customer-facing message
    # ("Fixr: Provider accepted your request.") but nothing for the provider.
    # The provider's message thread appears empty after accepting.
    #
    # Fix: insert a provider-targeted system message immediately after the
    # existing customer message block, using the same idempotency pattern.
    #
    # Insertion point: the closing lines of the customer message block, ending
    # with the comment "# Send notification to customer".
    # =========================================================================
    (
        "Fix 3 — Provider-side system message on acceptance (symmetric to customer message)",

        # ── OLD (exact from live file) ────────────────────────────────────────
        "        await db.job_messages.insert_one(accept_message)\n"
        "        # Update last_message_at for unread tracking\n"
        "        await db.service_requests.update_one(\n"
        "            {\"_id\": ObjectId(request_id)},\n"
        "            {\"$set\": {\"last_message_at\": msg_time}}\n"
        "        )\n"
        "    \n"
        "    # Send notification to customer",

        # ── NEW ───────────────────────────────────────────────────────────────
        "        await db.job_messages.insert_one(accept_message)\n"
        "        # Update last_message_at for unread tracking\n"
        "        await db.service_requests.update_one(\n"
        "            {\"_id\": ObjectId(request_id)},\n"
        "            {\"$set\": {\"last_message_at\": msg_time}}\n"
        "        )\n"
        "\n"
        "    # Fix 3: Provider-side acceptance message — mirrors the customer message above.\n"
        "    # Without this the provider thread is empty after accepting a job.\n"
        "    existing_provider_accept_msg = await db.job_messages.find_one({\n"
        "        \"requestId\": request_id,\n"
        "        \"type\": \"system\",\n"
        "        \"text\": {\"$regex\": \"You accepted this job\"},\n"
        "        \"targetRole\": \"provider\"\n"
        "    })\n"
        "    if not existing_provider_accept_msg:\n"
        "        prov_accept_time = datetime.utcnow()\n"
        "        provider_accept_message = {\n"
        "            \"requestId\": request_id,\n"
        "            \"senderId\": \"system\",\n"
        "            \"senderName\": \"Fixr\",\n"
        "            \"senderRole\": \"system\",\n"
        "            \"type\": \"system\",\n"
        "            \"text\": \"Fixr: You accepted this job. The customer has been notified. Send a quote when ready.\",\n"
        "            \"targetRole\": \"provider\",\n"
        "            \"createdAt\": prov_accept_time,\n"
        "            \"deliveredAt\": prov_accept_time,\n"
        "            \"readAt\": None,\n"
        "        }\n"
        "        await db.job_messages.insert_one(provider_accept_message)\n"
        "        await db.service_requests.update_one(\n"
        "            {\"_id\": ObjectId(request_id)},\n"
        "            {\"$set\": {\"last_message_at\": prov_accept_time}}\n"
        "        )\n"
        "\n"
        "    # Send notification to customer",
    ),
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def restore_backup() -> None:
    if BACKUP_PATH.exists():
        shutil.copy2(BACKUP_PATH, SERVER_PATH)
        print(f"\n⚠  Backup restored → {SERVER_PATH}")
    else:
        print("\n⚠  Could not restore — no backup found.")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    if not SERVER_PATH.exists():
        print(f"ERROR: {SERVER_PATH} not found.")
        print("Run this script from the Fixr project root OR from backend/:")
        print("  python backend/apply_patch.py")
        sys.exit(1)

    original = SERVER_PATH.read_text(encoding="utf-8")
    patched  = original

    print(f"\nFixr backend patcher")
    print(f"Target : {SERVER_PATH.resolve()}")
    print(f"Mode   : {'DRY RUN  (pass no flags to apply)' if DRY_RUN else 'APPLY'}")
    print("=" * 62)

    failed      = False
    applied     = 0
    skipped     = 0

    for description, old_text, new_text in PATCHES:
        count = patched.count(old_text)

        if count == 0:
            print(f"\n  ⏭  SKIP  — {description}")
            print(f"     Target string not found — already applied or file changed.")
            skipped += 1
            continue

        if count > 1:
            print(f"\n  ✗  ERROR — {description}")
            print(f"     Target string matches {count} locations (expected 1). Ambiguous — aborting.")
            failed = True
            break

        if DRY_RUN:
            old_lines = len(old_text.splitlines())
            new_lines = len(new_text.splitlines())
            print(f"\n  ✓  WOULD APPLY — {description}")
            print(f"     Replace {old_lines} line(s) with {new_lines} line(s).")
        else:
            patched = patched.replace(old_text, new_text, 1)
            print(f"\n  Change {applied + 1} applied — {description}")
            applied += 1

    if failed:
        print("\nAborted — no changes written.\n")
        sys.exit(1)

    if DRY_RUN:
        print("\n" + "=" * 62)
        print(f"Dry run complete — {len(PATCHES) - skipped} patch(es) would be applied, {skipped} skipped.")
        print("Run without --check to apply.\n")
        return

    if patched == original:
        print("\nℹ  No changes needed — all patches already applied.\n")
        return

    # Write backup first, then patched file
    shutil.copy2(SERVER_PATH, BACKUP_PATH)
    print(f"\n  📁  Backup → {BACKUP_PATH.name}")

    try:
        SERVER_PATH.write_text(patched, encoding="utf-8")
    except Exception as exc:
        print(f"\n  ERROR writing patched file: {exc}")
        restore_backup()
        sys.exit(1)

    print("\n" + "=" * 62)
    print(f"✅  Done — {applied} patch(es) applied, {skipped} skipped.")
    print("    Restart your backend:")
    print("      uvicorn backend.server:app --reload")
    print("=" * 62 + "\n")


if __name__ == "__main__":
    main()
