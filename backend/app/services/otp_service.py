# backend/app/services/otp_service.py
# Responsibility: Business logic for OTP (One-Time Password) verification flows.
# Covers phone number OTP (auth/verification) and job code OTP (start/completion).
# These are TWO DISTINCT OTP flows — do not merge them:
#   - Phone OTP: used for identity verification during auth
#   - Job code OTP: used for start and completion of a service job (protected behavior)
# Phase 1 shell (created in Phase 3.5 structural integrity fix).
# Phase 1: No logic, no functions. server.py remains the active backend.

# Functions to be defined in a future phase:
# - send_otp(phone)
# - verify_otp(phone, code)
# - verify_job_start_code(request_id, job_code)
# - verify_job_completion_code(request_id, job_code)
