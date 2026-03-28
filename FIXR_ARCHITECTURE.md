# FIXR ARCHITECTURE

## PURPOSE

This document defines the approved target architecture for the Fixr MVP backend and the supporting frontend boundaries during migration.

Its purpose is to:
- preserve the current working product flow
- prevent chaotic refactors
- separate responsibilities clearly
- make future development safer
- reduce regressions caused by single-file backend editing

This is not a product redesign document.
This is a controlled restructuring document.

---

## PRIMARY RULE

Do not redesign the product.

Do not change the official Fixr request lifecycle.

Do not replace the current workflow with a different marketplace model.

The architecture may be improved.
The structure may be modularized.
The code may be reorganized.
But the user-facing product flow must remain the same unless explicitly approved.

---

## CURRENT PROBLEM

The current backend is heavily concentrated in `server.py`.

That creates these risks:
- too many responsibilities in one file
- hard to isolate bugs safely
- easy to break unrelated features while fixing one issue
- difficult for AI coding agents or new developers to know where logic belongs
- duplicated status logic can create inconsistent behavior across screens
- messaging, notifications, payments, OTP, unread state, and request state can become tightly tangled

The goal is not to rebuild the app from scratch.

The goal is:

**same app behavior, cleaner structure**

---

## TARGET BACKEND STRUCTURE

Use this modular backend structure:

```text
backend/
  app/
    main.py
    config.py
    database.py
    dependencies.py

    routes/
      auth.py
      customer.py
      provider.py
      service_requests.py
      quotes.py
      messages.py
      request_events.py
      payments.py
      otp.py
      reviews.py
      notifications.py
      admin.py

    services/
      auth_service.py
      customer_service.py
      provider_service.py
      request_service.py
      quote_service.py
      message_service.py
      request_event_service.py
      payment_service.py
      otp_service.py
      review_service.py
      notification_service.py
      matching_service.py

    models/
      user.py
      provider_profile.py
      customer_profile.py
      service_request.py
      message.py
      request_event.py
      review.py
      payment.py
      otp_code.py
      notification.py

    schemas/
      auth.py
      user.py
      provider.py
      customer.py
      service_request.py
      quote.py
      message.py
      request_event.py
      payment.py
      otp.py
      review.py
      notification.py

    utils/
      status.py
      permissions.py
      validators.py
      time.py
      formatters.py

  server.py   # temporary migration bridge only