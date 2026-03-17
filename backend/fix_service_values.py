"""
fix_service_values.py
======================
Normalises the services[] array in every provider document so that
values match the exact lowercase serviceKey strings the frontend sends
(e.g. "plumbing", "electrical", "ac_hvac", "handyman").

The root cause of "No Providers available" is a case or format mismatch:
  Stored value      Frontend sends      MongoDB match?
  "Plumbing"        "plumbing"          ❌ NO — case-sensitive exact match
  "plumbing "       "plumbing"          ❌ NO — trailing space
  "Electrical Work" "electrical"        ❌ NO — different string entirely
  "plumbing"        "plumbing"          ✅ YES

This script:
  1. Reads every provider document
  2. For each services[] value, maps it to the correct serviceKey
  3. Removes unmapped values (with a warning) rather than leaving bad data
  4. Writes the corrected array back

USAGE:
    # Dry run — see what would change:
    python backend/fix_service_values.py --dry-run

    # Apply fixes:
    python backend/fix_service_values.py
"""

import asyncio
import sys
import os
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME   = os.environ["DB_NAME"]

DRY_RUN = "--dry-run" in sys.argv

# ── Canonical serviceKey values (from frontend/constants/serviceCategories.ts)
VALID_SERVICE_KEYS = {
    "plumbing", "electrical", "ac_hvac", "cleaning", "handyman",
    "painting", "carpentry", "roofing", "flooring", "masonry",
    "renovation", "landscaping", "fencing", "pools", "outdoor_structures",
    "appliance_repair", "security_systems", "smart_home", "pest_control",
    "windows_doors", "welding", "garage_doors", "moving", "delivery",
    "automotive", "events", "other",
}

# ── Mapping of known bad values → correct serviceKey
# Covers: capitalised labels, display names, legacy values
NORMALISATION_MAP: dict[str, str] = {
    # Capitalised versions of serviceKeys
    "Plumbing":          "plumbing",
    "Electrical":        "electrical",
    "Ac_Hvac":           "ac_hvac",
    "AC_HVAC":           "ac_hvac",
    "Cleaning":          "cleaning",
    "Handyman":          "handyman",
    "Painting":          "painting",
    "Carpentry":         "carpentry",
    "Roofing":           "roofing",
    "Flooring":          "flooring",
    "Masonry":           "masonry",
    "Renovation":        "renovation",
    "Landscaping":       "landscaping",
    "Fencing":           "fencing",
    "Pools":             "pools",
    "Appliance_Repair":  "appliance_repair",
    "Pest_Control":      "pest_control",
    "Windows_Doors":     "windows_doors",
    "Welding":           "welding",
    "Moving":            "moving",
    "Other":             "other",

    # Display label variants (as stored by the provider setup UI)
    "A/C & HVAC":                "ac_hvac",
    "A/C Repair":                "ac_hvac",
    "AC Repair":                 "ac_hvac",
    "Air Conditioning":          "ac_hvac",
    "Electrical Work":           "electrical",
    "Electrical Services":       "electrical",
    "Plumbing Services":         "plumbing",
    "Plumbing & Piping":         "plumbing",
    "Home Cleaning":             "cleaning",
    "Deep Cleaning":             "cleaning",
    "General Cleaning":          "cleaning",
    "General Handyman":          "handyman",
    "Handyman Services":         "handyman",
    "House Painting":            "painting",
    "Interior Painting":         "painting",
    "Appliance Repair":          "appliance_repair",
    "Pest Control":              "pest_control",
    "Windows & Doors":           "windows_doors",
    "General Renovation":        "renovation",
    "Home Renovation":           "renovation",
    "Pool Maintenance":          "pools",
    "Pool Services":             "pools",
    "Outdoor Structures":        "outdoor_structures",
    "Security Systems":          "security_systems",
    "Smart Home":                "smart_home",
    "Garage Doors":              "garage_doors",
    "Moving Services":           "moving",
    "Delivery Services":         "delivery",
    "Automotive Services":       "automotive",
    "Events & Catering":         "events",
    "Other Services":            "other",
}


def normalise_value(raw: str) -> str | None:
    """
    Map a stored services[] value to the correct serviceKey.
    Returns None if the value cannot be mapped (will be dropped with a warning).
    """
    stripped = raw.strip()

    # Already a valid serviceKey
    if stripped in VALID_SERVICE_KEYS:
        return stripped

    # Try lowercase
    lower = stripped.lower()
    if lower in VALID_SERVICE_KEYS:
        return lower

    # Try the explicit map
    if stripped in NORMALISATION_MAP:
        return NORMALISATION_MAP[stripped]

    # Try lowercase version of the map key
    for k, v in NORMALISATION_MAP.items():
        if k.lower() == lower:
            return v

    # Try replacing spaces with underscores (e.g. "pest control" → "pest_control")
    underscored = lower.replace(" ", "_").replace("/", "_").replace("&", "").replace("  ", "_")
    # Clean up double underscores
    while "__" in underscored:
        underscored = underscored.replace("__", "_")
    underscored = underscored.strip("_")
    if underscored in VALID_SERVICE_KEYS:
        return underscored

    return None  # Unmappable


async def run() -> None:
    client = AsyncIOMotorClient(MONGO_URL)
    db     = client[DB_NAME]

    print(f"\nFixr services[] normaliser")
    print(f"Database : {DB_NAME}")
    print(f"Mode     : {'DRY RUN — no changes written' if DRY_RUN else 'APPLY'}")
    print("=" * 66)

    providers = await db.providers.find({}).to_list(None)
    print(f"\nTotal providers: {len(providers)}")

    updated      = 0
    already_ok   = 0
    had_warnings = 0

    for p in providers:
        pid  = str(p["_id"])
        name = p.get("name", "Unknown")
        raw_services = p.get("services", [])

        if not raw_services:
            print(f"\n  ⚠  {name} ({pid})")
            print(f"     services[] is empty — provider will never match any request")
            had_warnings += 1
            continue

        new_services  = []
        changed       = False
        dropped       = []

        for val in raw_services:
            mapped = normalise_value(val)
            if mapped is None:
                print(f"\n  ⚠  {name} ({pid}): cannot map {val!r} — dropping it")
                dropped.append(val)
                had_warnings += 1
                changed = True
            elif mapped != val:
                new_services.append(mapped)
                changed = True
            else:
                new_services.append(val)

        # Deduplicate while preserving order
        seen = set()
        deduped = []
        for s in new_services:
            if s not in seen:
                deduped.append(s)
                seen.add(s)
        if len(deduped) != len(new_services):
            changed = True
            new_services = deduped

        if changed:
            print(f"\n  {name} ({pid})")
            print(f"    Before: {raw_services}")
            print(f"    After : {new_services}")
            if dropped:
                print(f"    Dropped (unmappable): {dropped}")

            if not DRY_RUN:
                await db.providers.update_one(
                    {"_id": p["_id"]},
                    {"$set": {"services": new_services}}
                )
            updated += 1
        else:
            already_ok += 1

    print("\n" + "=" * 66)
    if DRY_RUN:
        print(f"Dry run complete.")
        print(f"  Would update : {updated} provider(s)")
        print(f"  Already OK   : {already_ok} provider(s)")
        print(f"  Warnings     : {had_warnings}")
        if updated > 0:
            print("\n  Run without --dry-run to apply fixes.")
    else:
        print(f"Done.")
        print(f"  Updated  : {updated} provider(s)")
        print(f"  Already OK: {already_ok} provider(s)")
        print(f"  Warnings : {had_warnings}")
        if updated > 0:
            print("\n  ✅ Restart your backend and test the provider search again.")

    client.close()
    print()


if __name__ == "__main__":
    asyncio.run(run())
