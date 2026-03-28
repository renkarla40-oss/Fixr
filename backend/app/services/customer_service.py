# backend/app/services/customer_service.py
# Responsibility: Business logic for customer domain operations.
# Phase 3: Stub function signatures only.
#
# No logic, no DB calls, no imports from active modules.
# All customer business logic currently lives in server.py and remains there.
# Logic will be migrated from server.py in Phase 4+.
# This module is NOT connected to any active request flow.


async def get_customer_profile(user_id: str):
    """
    Retrieve a customer profile by user ID.
    Phase 4+: Will query db.users and return customer profile data.
    Migrated from server.py GET /users/profile handler.
    """
    pass


async def update_customer_profile(user_id: str, data: dict):
    """
    Update a customer profile by user ID.
    Phase 4+: Will update db.users with validated profile fields.
    Migrated from server.py PATCH /users/profile handler.
    """
    pass


async def switch_user_role(user_id: str, new_role: str):
    """
    Switch the active role for a user (customer / provider).
    Phase 4+: Will update db.users currentRole field.
    Migrated from server.py PATCH /users/role handler.
    """
    pass
