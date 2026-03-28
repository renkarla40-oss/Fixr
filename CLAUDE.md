# FIXR – CLAUDE CONTROL DOCUMENT

## 🚨 PRIMARY DIRECTIVE

You are working on a LIVE MVP (Fixr).

DO NOT redesign the product.
DO NOT change the product flow.
DO NOT introduce new features unless explicitly instructed.

Your role is to:
→ RESTRUCTURE the backend architecture safely
→ PRESERVE ALL EXISTING FUNCTIONALITY
→ IMPROVE MAINTAINABILITY ONLY

---

## ✅ CURRENT FIXR FLOW (LOCKED – DO NOT CHANGE)

Customer creates request  
Provider accepts  
Provider sends quote  
Customer accepts or counters  
Provider accepts/rejects counter  
Customer pays  
Provider starts job (OTP)  
Provider completes job (OTP)  
Customer leaves review  

This flow is FINAL and must not be modified.

---

## 🧠 ARCHITECTURE RULES

You must follow a **layered architecture**:

- Routes → API endpoints only
- Services → ALL business logic
- Models → database structure
- Schemas → request/response validation
- Utils → shared helpers ONLY

STRICT RULE:
Routes must NEVER contain business logic.

---

## ⚠️ NON-NEGOTIABLE SAFETY RULES

1. DO NOT break existing working flows
2. DO NOT rename existing API endpoints unless instructed
3. DO NOT change database schema unless required and approved
4. DO NOT refactor multiple domains at once
5. DO NOT introduce new dependencies unless approved
6. DO NOT move fast — move safely

---

## 🔄 MIGRATION STRATEGY (MANDATORY)

You MUST work in phases.

### Phase 1 – Structure only
- Create folders
- Create main.py
- Create config/database/dependencies files
- Register routers
- NO logic changes

### Phase 2 – Shared logic
- Move config
- Move DB connection
- Move status logic
- Move auth helpers

### Phase 3 – Read-only domains
- Customer routes
- Provider routes
- Provider directory

### Phase 4 – Service Requests
- Create request
- List requests
- Request detail
- Change provider logic
- Timeout logic

### Phase 5 – Quotes

### Phase 6 – Messaging Split
- Separate:
  - chat (human messages)
  - request_events (system updates)

### Phase 7 – Payments

### Phase 8 – OTP

### Phase 9 – Reviews + Notifications

### Phase 10 – Remove server.py

---

## 💬 MESSAGING RULE (CRITICAL CHANGE)

You are allowed to restructure messaging as follows:

Chat = ONLY human messages  
Request Events = ONLY system updates  

DO NOT mix them.

---

## 📊 STATUS LOGIC RULE

Status logic must exist in ONE place only:

- utils/status.py OR
- request_service.py

DO NOT duplicate status logic across files.

---

## 🔔 UNREAD & NOTIFICATIONS RULE

You must NOT mix:

- chat unread
- notification unread
- request events

Each must be handled separately.

---

## 🧱 DOMAIN BOUNDARIES

You must respect domain separation:

- Auth
- Customer
- Provider
- Service Requests
- Quotes
- Messages
- Request Events
- Payments
- OTP
- Reviews
- Notifications

DO NOT mix responsibilities across domains.

---

## 🛑 BEFORE MAKING ANY CHANGE

You MUST:

1. State what phase you are working on
2. List files you will modify/create
3. Explain risk of regression
4. WAIT for approval

---

## ✅ AFTER EVERY CHANGE

You MUST:

- List all files changed
- Confirm what was NOT affected
- Highlight any risk areas
- Stop and wait for next instruction

---

## 🚫 WHAT YOU MUST NEVER DO

- Do not rewrite server.py entirely
- Do not "clean up everything"
- Do not refactor multiple systems at once
- Do not assume missing logic
- Do not introduce silent breaking changes

---

## 🎯 GOAL

Transform Fixr from:

→ single-file backend (server.py)

into:

→ structured, scalable architecture

WITHOUT changing how the app behaves.

---

## 🧭 FINAL RULE

Slow, controlled, phase-based migration ONLY.

If unsure:
→ STOP
→ ASK
→ WAIT