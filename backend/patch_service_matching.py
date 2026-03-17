"""
patch_service_matching.py
==========================
Patches backend/server.py to make the service filter in get_providers()
case-insensitive and whitespace-tolerant.

WHY THIS IS NEEDED:
  The current query is:
      query["services"] = service
  This does a case-sensitive exact match against the services[] array.
  If any provider stored "Plumbing" instead of "plumbing", they are
  invisible when a customer submits a plumbing request.

THE FIX:
  Replace the exact match with a case-insensitive regex:
      query["services"] = {"$regex": f"^{re.escape(service.strip())}$", "$options": "i"}
  This matches regardless of capitalisation or leading/trailing spaces.
  "plumbing", "Plumbing", "PLUMBING" all match when service="plumbing".

ALSO ADDS:
  A debug log line that prints which providers are returned (or why zero
  matched) — visible in the backend terminal when FIXR_DEBUG=1 is set.

USAGE:
    python backend/patch_service_matching.py           # apply
    python backend/patch_service_matching.py --check   # dry run
"""

import sys
import shutil
from pathlib import Path

_THIS_DIR   = Path(__file__).parent
SERVER_PATH = _THIS_DIR / "server.py"
BACKUP_PATH = _THIS_DIR / "server.py.bak2"
DRY_RUN     = "--check" in sys.argv

# ── Patch 1: Add `import re` if not already present ─────────────────────────
# server.py does not currently import re; we need it for re.escape()
PATCH_IMPORT = (
    "Add `import re` for service filter regex",

    # OLD — the existing import block ends with these lines
    "import jwt\n"
    "from passlib.context import CryptContext\n"
    "from dotenv import load_dotenv",

    # NEW — add `import re` alongside the stdlib imports
    "import re\n"
    "import jwt\n"
    "from passlib.context import CryptContext\n"
    "from dotenv import load_dotenv",
)

# ── Patch 2: Make service filter case-insensitive ────────────────────────────
PATCH_SERVICE_FILTER = (
    "Make service filter in get_providers() case-insensitive regex",

    # OLD — exact from live file
    "    # Filter by service if specified\n"
    "    if service:\n"
    "        query[\"services\"] = service\n"
    "    \n"
    "    providers = await db.providers.find(query).to_list(100)",

    # NEW — regex match + debug logging
    "    # Filter by service if specified.\n"
    "    # Use case-insensitive regex so stored values like 'Plumbing' match\n"
    "    # the frontend serviceKey 'plumbing'. This prevents the silent mismatch\n"
    "    # that causes 'No Providers available' after a customer submits a request.\n"
    "    if service:\n"
    "        query[\"services\"] = {\n"
    "            \"$regex\": f\"^{re.escape(service.strip())}$\",\n"
    "            \"$options\": \"i\",  # case-insensitive\n"
    "        }\n"
    "\n"
    "    providers = await db.providers.find(query).to_list(100)\n"
    "\n"
    "    # Debug log — set FIXR_DEBUG=1 in your .env to see matching details\n"
    "    import os as _os\n"
    "    if _os.getenv('FIXR_DEBUG') == '1':\n"
    "        logger.info(\n"
    "            f\"get_providers: service={service!r}, \"\n"
    "            f\"query={query}, \"\n"
    "            f\"found={len(providers)} provider(s): \"\n"
    "            f\"{[p.get('name') for p in providers]}\"\n"
    "        )",
)

PATCHES = [PATCH_IMPORT, PATCH_SERVICE_FILTER]


def main() -> None:
    if not SERVER_PATH.exists():
        print(f"ERROR: {SERVER_PATH} not found. Run from Fixr root or backend/.")
        sys.exit(1)

    original = SERVER_PATH.read_text(encoding="utf-8")
    patched  = original

    print(f"\nFixr service matching patch")
    print(f"Target : {SERVER_PATH.resolve()}")
    print(f"Mode   : {'DRY RUN' if DRY_RUN else 'APPLY'}")
    print("=" * 62)

    applied = 0
    skipped = 0
    failed  = False

    for description, old_text, new_text in PATCHES:
        count = patched.count(old_text)

        if count == 0:
            print(f"\n  ⏭  SKIP  — {description}")
            print(f"     Already applied or target not found.")
            skipped += 1
            continue

        if count > 1:
            print(f"\n  ✗  ERROR — {description}")
            print(f"     Target matched {count} times. Ambiguous. Aborting.")
            failed = True
            break

        if DRY_RUN:
            print(f"\n  ✓  WOULD APPLY — {description}")
        else:
            patched = patched.replace(old_text, new_text, 1)
            print(f"\n  Change {applied + 1} applied — {description}")
            applied += 1

    if failed:
        print("\nAborted — no changes written.\n")
        sys.exit(1)

    if DRY_RUN:
        print(f"\n{'='*62}")
        print(f"Dry run — {len(PATCHES) - skipped} patch(es) would be applied.\n")
        return

    if patched == original:
        print("\nℹ  No changes needed.\n")
        return

    shutil.copy2(SERVER_PATH, BACKUP_PATH)
    print(f"\n  📁  Backup → {BACKUP_PATH.name}")

    try:
        SERVER_PATH.write_text(patched, encoding="utf-8")
    except Exception as exc:
        print(f"\nERROR: {exc}")
        shutil.copy2(BACKUP_PATH, SERVER_PATH)
        sys.exit(1)

    print(f"\n{'='*62}")
    print(f"✅  Done — {applied} patch(es) applied, {skipped} skipped.")
    print("    Restart backend: uvicorn backend.server:app --reload")
    print(f"{'='*62}\n")


if __name__ == "__main__":
    main()
