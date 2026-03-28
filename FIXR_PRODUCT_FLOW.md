# FIXR PRODUCT FLOW

## PURPOSE

This document defines the official Fixr MVP product flow.

It exists to protect the current working behavior of the app during backend restructuring, refactoring, and future feature development.

This document is the source of truth for:
- request lifecycle
- provider/customer responsibilities
- quote flow
- payment flow
- OTP flow
- completion flow
- review flow

If architecture changes are made, they must preserve this flow unless explicitly approved.

---

## CORE RULE

Do not redesign the product.

Do not change the customer-provider workflow.

Do not introduce a different booking model.

Do not convert this into a bidding marketplace, instant-book marketplace, or chat-first marketplace.

Fixr’s flow remains:

1. Customer creates a request
2. Provider receives the request
3. Provider accepts the request
4. Provider sends a quote
5. Customer accepts or counters
6. Provider accepts or rejects the counter
7. Customer pays
8. Provider starts the job with OTP
9. Provider completes the job with OTP
10. Customer leaves a review

This flow is locked.

---

## FIXR MVP OVERVIEW

Fixr is a service marketplace where customers in Trinidad and Tobago can request skilled services and connect with providers.

The platform is not based on instant booking.

The platform is not based on random open bidding.

The platform is based on controlled request assignment and approval.

The provider must respond to the request.
The quote must be agreed.
Payment must be secured before work starts.
OTP must validate start and completion.
Review happens after completion.

---

## PRIMARY USER ROLES

### Customer
The customer can:
- browse providers or services
- create a job request
- view request status
- receive and review quotes
- counter a quote
- approve and pay
- communicate with the provider
- track job updates
- confirm completion through workflow
- leave a review

### Provider
The provider can:
- maintain a provider profile
- appear in search/directory if eligible
- receive assigned requests
- accept a request
- send a quote
- accept or reject a customer counter
- communicate with the customer
- start a job using OTP
- complete a job using OTP
- manage availability status

---

## OFFICIAL REQUEST FLOW

### STEP 1 — CUSTOMER CREATES REQUEST

Customer creates a service request.

A request may include:
- service category
- subcategory
- job description
- photos if supported
- preferred date/time if supported
- location details if supported

After request creation:
- the request enters the system as pending
- a provider is assigned or selected according to current Fixr logic
- the request becomes visible in the relevant customer/provider flows
- system updates and notifications are triggered

### STEP 2 — PROVIDER RECEIVES REQUEST

The provider receives the request.

The provider is informed that:
- a request has been assigned to them
- they have up to 24 hours to respond

Important:
- the provider should not be allowed to silently ignore requests forever
- the 24-hour provider timeout behavior is protected
- if the provider does not respond in time, the request must be released so the customer can choose another provider

### STEP 3 — PROVIDER ACCEPTS REQUEST

If the provider accepts:
- the request moves forward in the flow
- the provider is now expected to send a quote

Important:
- provider acceptance does not mean the job has started
- provider acceptance does not mean payment is complete
- provider acceptance means the provider is willing to take the job and proceed to pricing

### STEP 4 — PROVIDER SENDS QUOTE

The provider sends a quote for the job.

The quote may reflect:
- labor
- materials
- total cost
- other structured pricing fields if supported

After the quote is sent:
- the customer is notified
- the request waits for customer action

### STEP 5 — CUSTOMER ACCEPTS OR COUNTERS

Customer may:

#### Option A — Accept quote
If accepted:
- the request proceeds to payment

#### Option B — Counter offer
If customer counters:
- provider must review the counter
- provider may accept or reject the counter

Important:
- this counter flow is part of the official Fixr model
- do not remove it
- do not replace it with “message the provider to negotiate manually”

### STEP 6 — PROVIDER ACCEPTS OR REJECTS COUNTER

If provider accepts customer counter:
- agreed price is updated
- request proceeds to payment

If provider rejects customer counter:
- customer must decide next available action according to current app behavior

Important:
- quote agreement must happen before payment
- payment must never happen before a final agreed price exists

### STEP 7 — CUSTOMER PAYS

Customer pays after quote agreement.

Important rules:
- payment happens before the provider starts the job
- held payment logic is protected
- payment confirmation changes what the provider/customer can do next
- payment logic must remain consistent across request list, request detail, and provider/customer views

Protected behavior:
- `awaiting_payment` + held payment should move the request into the effective ready-to-start experience

### STEP 8 — PROVIDER STARTS JOB WITH OTP

Provider cannot start work freely without verification.

Provider starts the job using the official Fixr start OTP process.

Important:
- start OTP is a protected behavior
- do not replace this with a simple button-only start
- do not bypass verification

After valid start OTP:
- request moves into active work / in-progress state

### STEP 9 — PROVIDER COMPLETES JOB WITH OTP

Provider completes the job using the official Fixr completion OTP process.

Important:
- completion OTP is a protected behavior
- do not remove this requirement
- do not collapse start and completion verification into one code

After valid completion OTP:
- request moves to completion pending review or equivalent finalization state

### STEP 10 — CUSTOMER LEAVES REVIEW

After successful completion:
- customer is prompted to leave a review
- provider receives review outcome through the platform
- duplicate reviews for the same request should not be allowed

Important:
- review after completion is protected behavior
- review belongs after completion, not before

---

## PROTECTED PLATFORM RULES

The following behaviors are locked and must not be changed during architecture migration:

### 1. 24-HOUR PROVIDER RESPONSE WINDOW
Providers have up to 24 hours to respond to a request.

### 2. CHANGE PROVIDER FLOW
If a provider does not respond or the customer needs another provider, the customer can choose another provider according to current Fixr logic.

### 3. EXCLUDED PROVIDER LOGIC
Providers who timed out, were rejected in flow, or were changed out should not be re-offered improperly for the same request where exclusion applies.

### 4. HELD PAYMENT LOGIC
Payment handling before job start is protected.

### 5. START OTP
Work begins only after valid start verification.

### 6. COMPLETION OTP
Work completes only after valid completion verification.

### 7. REVIEW AFTER COMPLETION
Customer review comes after completion.

### 8. AVAILABILITY MATTERS
Provider availability must continue to affect customer-facing provider interactions in the currently intended way.

### 9. MATCHING BY SERVICE
Provider matching/filtering must remain tied to the provider’s actual service offerings.

### 10. STATUS CONSISTENCY
Status shown across the app must come from one shared source of truth.

---

## OFFICIAL STATUS LIFECYCLE

Internal statuses currently recognized in Fixr include:

- pending
- accepted
- awaiting_payment
- in_progress
- completed_pending_review
- completed
- declined
- cancelled

Payment statuses include:
- unpaid
- held
- released
- refunded

Important display rule:
Some displayed states are derived from combined logic, not raw status alone.

Example:
- `awaiting_payment` + paymentStatus `held` may need to display as `ready_to_start`

This display logic must remain centralized and must not be duplicated inconsistently across screens.

---

## MESSAGING AND JOB UPDATE RULE

Fixr has two different communication needs:

### 1. Human conversation
This is customer-provider chat.

### 2. System-generated request updates
These are platform events such as:
- request created
- provider assigned
- provider accepted
- quote sent
- counter sent
- payment received
- ready to start
- in progress
- completed
- review pending
- customer cancelled
- provider cancelled

These must remain logically distinct.

Approved architecture direction:
- Chat = human messages only
- Request Events / Job Updates = system updates only

This separation is allowed and encouraged during architecture rebuild.

What must not change:
- the meaning of each event
- the timing of each event
- the user’s ability to understand what happened on a request

---

## UNREAD AND NOTIFICATION RULES

These must remain separate concepts:

### Chat unread
Unread human messages between customer and provider.

### Notification unread
Bell/notification center items.

### Request event unread or unseen state
System updates tied to job progression.

Do not mix them.
Do not calculate them using different competing rules in different parts of the app.

---

## PROVIDER DIRECTORY RULE

Provider cards shown across the app must remain consistent.

The same provider should not appear one way in:
- provider directory
- request provider selection
- request detail preview

Provider card behavior and matching inputs should come from a normalized source.

---

## CANCELLATION / CHANGE SAFETY

Cancellation and reassignment logic must remain careful.

Important:
- no silent corruption of request state
- no payment-state mismatch
- no provider reassignment bugs
- no duplicate active provider confusion on one request unless intentionally supported by design

---

## MIGRATION RULE FOR DEVELOPERS

When restructuring backend or frontend architecture:

- preserve the request lifecycle exactly
- preserve the quote lifecycle exactly
- preserve payment-before-start exactly
- preserve OTP verification exactly
- preserve review-after-completion exactly

Allowed:
- cleaner architecture
- modular routing
- service-layer separation
- normalized models
- request events separated from chat

Not allowed:
- changing the product flow
- skipping steps in the lifecycle
- merging payment/start/completion into shortcuts
- replacing controlled flow with a looser marketplace model

---

## FINAL SOURCE OF TRUTH

If a code change conflicts with this document, this document wins.

If an architecture change threatens this flow, stop and request approval.

If a refactor makes the flow ambiguous, preserve behavior first and clean up later.

The Fixr MVP is not being reinvented.
It is being stabilized and restructured safely.