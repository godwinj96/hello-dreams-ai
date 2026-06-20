# Incomplete Features Audit

**Last updated:** June 2026 — post gap-remediation pass.

## Summary

Critical user flows from the original audit (phases 0–5) are implemented end-to-end. Post-implementation audit gaps have been addressed.

| Area | Status |
|------|--------|
| Credits (token-based, Free 5 / Pro 100 daily) | ✅ Implemented; pending subs no longer get Pro limits |
| Paystack subscriptions + webhooks | ✅ Init with plan + callback; verify endpoint; renewal `charge.success` extends period |
| Auth (forgot/reset, Google OAuth, email verify) | ✅ Backend + frontend pages |
| Persona builder (API questions, optionId, result screens) | ✅ Implemented |
| Document builder (cover letter + personal statement toggle) | ✅ Implemented |
| Career profile (CV upload, voice) | ✅ Implemented |
| Job application (search, match score, ATS apply, doc generation) | ✅ Match scores computed per-user at response time |
| Conversation history (all modules) | ✅ Career, resume, documents, headshots, job applications |
| Profile settings editing | ✅ `PUT /users/:id` in user-profile |
| Payments UI (callback verify, billing history, paywall) | ✅ Implemented |

## Remaining / optional work

1. **E2E / integration tests** — payment webhooks, credit deduction, OAuth flows.
2. **Remove `matchScore` column from `job_listings`** — optional schema cleanup; column is no longer written but remains on the entity for backward compatibility.
3. **Staging Paystack configuration** — ensure `PAYSTACK_SECRET_KEY`, `PAYSTACK_PLAN_CODE`, `FRONTEND_URL`, and webhook URL `POST /payments/webhook` are set in each environment.

---

## Historical audit (pre-implementation)

The sections below describe the original audit state. Items marked ❌ in the original audit are now complete unless noted in "Remaining / optional work" above.

### 1. Job Application Module

**Original status:** Entities only, no implementation.

**Current status:** Full module with search adapters (SerpAPI, Careerjet, JSearch, Remotive), matching service, document generation, and ATS apply (Greenhouse/Lever).

### 2. Payments & Credits

**Original gaps:** No frontend checkout, webhook not activating Pro plan.

**Current status:** Paystack checkout, `/payments/callback`, paywall modal, subscription lifecycle (pending → active), token-based credit metering.

### 3. Auth flows

**Original gaps:** Forgot password, Google OAuth redirect, email verification.

**Current status:** Resend email module, `/reset-password`, `/auth/callback`, `/auth/verify-email`, resend on verify-account step.

### 4. Persona builder

**Original gaps:** Hardcoded questions, option ID mismatch.

**Current status:** API-driven questions, `optionId` migration, result components consume API persona data.

### 5. Document generator

**Original gaps:** Personal statement not exposed in UI.

**Current status:** Document type toggle in cover-letter module; history shows Personal Statement vs Cover Letter labels.
