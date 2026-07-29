# Frontend Implementation Checklist — `contact-capture-frontend` (Web)

Derived from `Contact_Capture_Event_Management_MVP_SRS_v3.0.md` (MVP Pilot Edition v3.0). Scope: Next.js web app only. Requirement IDs are cited so PRs/commits/tests can reference them per `CLAUDE.md` traceability rules. Where the SRS states a rule is server-authoritative, the web app must not treat its own check as sufficient — the backend is the source of truth.

## 0. Repo & Environment Setup
- [x] Next.js + TypeScript project scaffolded per `MVP-017` / §7.4.
- [x] `README.md` with local setup — §10.2.
- [x] `.env.example` with variable **names only**, no values — §10.2, §11.6.
- [x] `CONTRIBUTING.md`, `SECURITY.md` (secret-handling rules) — §10.2.
- [x] `.claude/skills/kiro-style-sdd/SKILL.md` (or approved equivalent) present — §10.2. Implemented as a pointer skill that documents the existing `.kiro/specs/` + `.kiro/steering/` workflow already used in this repo.
- [x] `specs/<feature>/{requirements,design,tasks}.md` structure adopted — §10.2. Satisfied via the existing `.kiro/specs/<feature-name>/` structure (approved equivalent); no separate root `specs/` dir created.
- [ ] CI workflow: type check, lint, unit/component tests, build, Vercel preview deploy — §11.8 (Frontend). Lint/typecheck/test/build/secret-scan already run in `.github/workflows/ci.yml`; `deploy-dev.yml` still has a **placeholder** deploy step pending a hosting-provider decision. CI/CD config changes need human sign-off per `CLAUDE.md` — not implemented yet.
- [ ] Frontend pins a specific backend OpenAPI contract version/tag; generated typed client checked in or generated in CI — §10.3. Blocked: no backend OpenAPI contract exists in this repo yet.
- [x] Only public config in frontend env: Supabase URL, Supabase anon key, backend base URL, build/environment label — §11.6. **No service-role key, no OpenAI key, no HighLevel secrets in browser bundle** — §4.3, §11.6, §18.1.

## 1. Authentication — `FR-MVP-AUTH-001`
**Status: implemented on `feature/auth-login`, [PR #5](https://github.com/Ideahub-Solutions-LLC/cotople-frontend-app/pull/5) open, NOT merged.** ✅ **Architecture question resolved:** a `POST {{NEXT_PUBLIC_API_BASE_URL}}/auth/login` (`{identifier, password, client_type}`) contract surfaced that would have implied the backend issues its own session/token, conflicting with SRS §5.1/§7.4/§4.3. Confirmed (2026-07-25) that the frontend calling `supabase.auth.signInWithPassword` directly, with the backend only verifying Supabase JWTs, is the correct approach — the `/auth/login` snippet is not the intended web login flow. No implementation change required.
- [x] Email/password login via Supabase Auth client SDK (no custom JWT/refresh-token UI) — `MVP-001`, §5.1. Implemented as designed and confirmed correct.
- [x] Session persisted using platform-appropriate secure storage. `@supabase/ssr` cookie-based session, browser/server clients in `src/lib/supabase/`.
- [x] AC-AUTH-001: seeded active user can sign in from web. **Resolved and confirmed.** Root cause of the earlier failed attempt: a typo in that specific try, not an app bug — confirmed via a direct `curl` against Supabase's `/auth/v1/token?grant_type=password` (correct credentials succeeded, returned a valid session) and via DevTools showing `sb-*` session cookies present in the browser, i.e. sign-in genuinely succeeded and the session persisted.
- [x] AC-AUTH-002: invalid credentials show a **generic** error message (no user enumeration). Confirmed working in the manual attempt above — correct generic copy displayed.
- [x] AC-AUTH-003: unauthenticated requests to protected routes/API calls are rejected client-side and gracefully redirect to login. `src/proxy.ts` + `src/app/(protected)/layout.tsx`.
- [x] AC-AUTH-004: Staff-role UI does not expose Admin-only actions, but treat this as convenience only — actual enforcement is server-side (§4.3). `useSession()` fails closed to `role: null` (hidden) on any failure.
- [x] AC-AUTH-005: confirm no custom refresh-token table/password-hashing code exists in this repo. Confirmed — none added.
- [x] Session-expired UX matches required message pattern: "Your session expired. Sign in again; your unsaved draft may need to be re-entered." — §6.3. `src/lib/api/session-expired.ts` + flash-message read in `LoginForm.tsx`.
- [ ] ⚠️ Auth/session code requires mandatory human reviewer sign-off before merge — `CLAUDE.md`. **Not yet reviewed/approved — PR #5 open.**

## 2. Authorization (Client-Side Convenience Layer) — §4
**Status: mechanism implemented on `feature/authorization-ui` (`.kiro/specs/authorization-ui/`), not yet merged.** Note: no real Admin-only screen exists yet to consume this — event create/edit (Section 3) and GHL install/status/retry (Section 12) remain separate, unbuilt specs. This closes the reusable gating *mechanism*; wiring it into an actual screen happens when those sections are built.
- [x] Role read from `profiles.role` (`admin` | `staff`) via `/api/v1/me` — `MVP-002`. Already established by `auth-login`'s `useSession()`; `RequireRole` (`src/components/auth/RequireRole.tsx`) consumes it, adding no second role-fetch path.
- [x] UI conditionally renders Admin-only controls (event create/edit, GHL install/status, retry actions) but never relies on hiding UI as a security boundary. `RequireRole` provides the reusable primitive (`allow`/`fallback` props, fails closed on `loading`/`null`/mismatch), explicitly documented and tested as UX-only — see `.kiro/specs/authorization-ui/requirements.md` AUTHZ-0002. Not yet wired into a real screen (none exist yet).
- [x] Only Admin and Staff roles built — do **not** build UI for Viewer/Support/API Consumer/DevOps (explicit repo instruction + §4.2). Verified: `ProfileRole` remains `"admin" | "staff"` only (diffed against `main`, unchanged); repo-wide grep for viewer/support/api_consumer/devops role references returned nothing.

## 3. Event Management — `FR-MVP-EVT-001`
**Status: implemented on `feature/event-management` (`.kiro/specs/event-management/`), not yet merged.** Branched off `feature/authorization-ui` since this spec's Admin-only UI depends on `RequireRole`, which isn't merged yet either. ⚠️ **No backend OpenAPI contract exists checked into this repo** (Section 0) — request/response shapes are built against SRS §8.3/§9.2 as the best available source; see `API-0001` in the spec for the explicit risk this accepts. **Manual verification against a real backend is complete** — `contact-backend-api` + local Supabase are reachable in this dev setup; full create/edit/archive/role/owner-filter flow verified against both, results in `.kiro/specs/event-management/exit-validation.md`.
- [x] Event list/select screen (Admin + Staff) — §6.2. `EventList.tsx` + `page.tsx` at `/events`; loading/empty/error-with-retry states.
- [x] Event create/edit screen (Admin only, web-sufficient per §6.2). `/events/new` and `/events/[id]/edit`, both gated by `RequireRole allow="admin"` with an `AdminOnlyNotice` fallback (convenience only — backend independently enforces). **Found and fixed during review**: the initial implementation built both pages but never linked to the edit page from anywhere in the UI — added an Admin-only "Edit" link per event in `EventList`.
- [x] Fields & validation: name (2–150 chars, required), date/time (ISO 8601, stored/displayed correctly for UTC), location (optional, ≤255 chars), notes (optional, ≤2000 chars), status (`active`/`archived`) — §5.2. `EventForm.tsx`; status changes only via the dedicated archive action, never a form field, per §9.2.
- [x] Archived events are not selectable for new captures in the UI. Relies on the backend's `GET /api/v1/events` already scoping to active/authorized events per §9.2's own wording ("List active/authorized events") — the client does no additional client-side filtering. Verified against a real backend: after archiving an event, it dropped out of both Admin's and Staff's default (active-only) list view, with no `include_archived=true` sent by this UI.
- [ ] Existing occurrences under an archived event remain viewable. **Not built** — occurrence history display is owned by the contact-detail/occurrence-history spec (`SRS_CHECKLIST.md` Section 13), not yet started. This event-management spec only guarantees archiving doesn't delete/hide anything client-side; it doesn't yet render any occurrence history at all.
- [x] Uses `GET/POST/PATCH /api/v1/events`, `POST /api/v1/events/{id}/archive` — §9.2. `src/lib/api/events.ts`. Also adds `GET /api/v1/events/{id}` (single-event fetch for the edit screen's pre-fill), an endpoint not explicitly listed in SRS §9.2 — explicitly flagged as an assumption in the spec's design.md, to be corrected once a real OpenAPI contract exists.

## 4. Manual Contact Capture — `FR-MVP-CON-001`
- [x] Manual entry form: first name, last name, company, position, phone, email, website, address, occurrence notes — §5.3. (`capture-manual-forms` spec, `ManualCaptureForm.tsx`.)
- [x] Client-side validation mirrors §5.3 rules (trim, length limits, phone/email format) but treat as UX assist only — final validation is server-side via `/api/v1/contacts/resolve`.
- [x] At least one of phone/email enforced before submit.
- [x] Journey A (Manual Capture) implemented end-to-end per §6.1: sign in → select event → "Enter Manually" → enter data → validation → duplicate result → confirm → success + sync status. Verified via component tests plus real API calls against a live backend (see `exit-validation.md`); full click-through browser verification was not possible in this session (no browser-automation tool available), so that specific gap is noted there rather than silently assumed passing.
- [x] Uses `POST /api/v1/events/{event_id}/contacts` — §9.2. Verified against the real backend.
- [x] Idempotency key generated client-side per capture submission — §9.4. Client generates and sends the key (`Idempotency-Key` header) on every final capture submission. **Note:** manual verification against the real backend found that retrying with the identical key did *not* dedupe — a second occurrence was created. This is a backend-side behavior gap (or the header isn't yet wired to a dedup mechanism there), not a client defect; recorded in `exit-validation.md` as a known, unresolved-by-this-repo gap.

## 5. Business-Card Image Capture — `FR-MVP-IMG-001`
- [x] Accept only JPEG/PNG; reject others client-side before upload — §5.4.
- [x] Enforce 5 MB max client-side before upload; show required error message: "This image is larger than 5 MB. Choose a smaller JPEG or PNG." — §6.3.
- [x] **Upload directly to private Supabase Storage** using signed URL from `POST /api/v1/images/upload-url` — never proxy image bytes through the backend/Vercel function (4.5 MB body limit) — §5.4, §7.6, `MVP-005`. Verified with a real signed-URL request and a real direct PUT to Supabase Storage (200 OK) during Task 7 manual verification.
- [x] Upload progress indicator with cancel/retry — §5.4.
- [x] No public bucket access assumptions in client code.
- [x] Selfie capture UI is explicitly **not** built (out of MVP scope) — §3.5.
- [x] PDF business cards not supported — §3.5.

## 6. QR / vCard Processing — `FR-MVP-QR-001`
- [ ] Client-side (or backend-triggered) QR decode attempt before AI extraction.
- [ ] Valid vCard populates candidate fields tagged source `qr`.
- [ ] Plain URLs/arbitrary text not treated as complete contact records.
- [ ] Unsafe/parsed links displayed as inert text — never auto-opened — §5.5.
- [x] QR-derived values remain fully editable in review form. Backend-side QR-then-AI extraction runs transparently inside `POST /api/v1/images/{id}/extract` (§9.2); the client (`ManualCaptureForm`'s autofill, `event-image-form` spec) treats every returned field — regardless of whether its `source` is `qr` or `ai` — as a plain editable input, never locked or auto-committed. No client-side QR decoding of its own is implemented (that part of this line remains unchecked above).
- [x] No/partial QR routes to AI extraction (`POST /api/v1/images/{id}/extract`) — §9.2. `src/lib/api/images.ts`'s `extractImage`, called automatically on upload success (`event-image-form` spec, Task 1/3). Verified against the real backend — see that spec's `exit-validation.md`.

## 7. AI-Assisted Extraction UX — `FR-MVP-AI-001`
- [x] Extraction progress UI: simple stage text, not a complex job monitor — §6.2. `CaptureSection`'s "Reading card…" status text (`event-image-form` spec).
- [x] Renders only the approved schema fields (first/last name, company, position, phone, email, website, address, warnings) — §5.6. `ManualCaptureForm`'s autofill effect only maps the 8 named `ExtractableFieldName` keys; any other key in the response's `fields` object is structurally ignored (not iterated).
- [x] Unexpected/extra fields from API response are ignored, not rendered. Same mechanism as above.
- [x] Invalid phone/email values flagged visibly in review UI. The existing `ManualCaptureForm` `validate()` (unchanged) applies to autofilled values exactly as it does to manually-typed ones — flagged on submit, not live-as-you-autofill.
- [ ] Provider failure UX: image and draft preserved; required message: "We could not read this card. Your image is saved; enter the details manually or retry." **Not verbatim.** `event-image-form`'s actual copy is "Couldn't automatically read fields from this image. You can still enter the contact's details manually below." — conveys the same information (image preserved, manual entry available) but doesn't match this SRS §6.3 line word-for-word. Flagged here rather than silently checked off; a copy pass to align exact wording is a reasonable, low-risk follow-up.
- [x] Manual entry remains available as fallback after AI failure. `CaptureSection`/`ManualCaptureForm` never block manual entry regardless of extraction outcome (`EIF-0001` AC4).
- [x] **No confidence-percentage UI claims** (MVP does not calibrate confidence) — §5.6. None built.

## 8. Human Review Screen — `FR-MVP-REV-001`
- [ ] Displays: contact fields, event context, image thumbnail, source badge (Manual/QR/AI), field-level validation errors, existing-contact match summary, final action button. **Partially built**: contact fields + field-level validation errors are shown (existing `ManualCaptureForm`), but there is no image thumbnail inside the review form itself (only in the separate upload dropzone), no per-field source badge, and no existing-contact match summary for the image-capture path specifically. `event-image-form/requirements.md` explicitly scoped out a distinct per-field review UI in favor of plain editable inputs — see that spec's Out of Scope and the Decisions section of its design.md.
- [x] Every proposed field is editable; **no extracted value auto-saves** — explicit user confirmation required (repo instruction + §5.7). `event-image-form` spec, `EIF-0002` AC3 — verified by a dedicated test that edits an autofilled field.
- [x] Edited fields are revalidated client-side (and ultimately server-side). Existing `validate()`, unchanged, runs regardless of autofill (`EIF-0002` AC4).
- [ ] Final confirmation copy clearly states "Create Contact" vs "Update Existing Contact and Add Occurrence." Not built — `CaptureSuccess`'s copy (shared by both manual and image paths) states sync status, not create-vs-update.
- [x] Uses `POST /api/v1/images/{id}/confirm` (image/QR/AI path) or `POST /api/v1/events/{event_id}/contacts` (manual path) — §9.2. `event-image-form` spec, `EIF-0003` — verified against the real backend (both a fresh confirm and a post-failed-extraction confirm returned real `201`s; see that spec's `exit-validation.md`).

## 9. Duplicate Detection UX — `FR-MVP-DUP-001`
- [x] Duplicate-decision screen surfaces phone-first, email-second exact-match logic result from `POST /api/v1/contacts/resolve` — §5.8, §9.2. Manual-entry path only (`capture-manual-forms` spec). **Not available for the image-capture path**: `confirm` has no separate dry-run resolve step, so an image-sourced phone/email match is auto-resolved server-side without a `DuplicateReview` confirmation screen — an intentional, explicitly documented gap (`event-image-form/design.md` Decisions: "No duplicate-review (resolve) step for image-sourced contacts"), not an oversight.
- [x] Required message shown on match: "A contact with this phone number already exists. Review the existing and incoming values before continuing." — §6.3. Manual-entry path only (see note above for the image path's gap).
- [x] Ambiguous match (phone/email point to different records, or multiple records share an identifier) routes to **Admin review**, never silently auto-merges/auto-selects — §5.8. Both paths: manual (`step === "ambiguous"`, pre-existing) and image (`event-image-form` `EIF-0003` AC4, catching `409 AMBIGUOUS_DUPLICATE` from `confirm` and reusing the same ambiguous-review UI). The image path's `409` handling is unit-tested with a schema-accurate mocked response; a live-backend reproduction of a true ambiguous conflict was attempted but not achieved this session (see `event-image-form/exit-validation.md`).
- [x] No-match path clearly indicates a new contact will be created. Both paths.
- [x] Match still always results in a new event occurrence, never a skipped save. Both paths — confirmed live for the image path (`duplicate_resolution: "phone_match"` still created a new `occurrence` row, per `exit-validation.md`).

## 10. Contact Update / Merge UX — `FR-MVP-UPD-001`
- [ ] Field-level conflict UI: empty existing + valid incoming → add after confirm; identical after normalization → no-op; different values manually confirmed → show both, user chooses; different values from AI/QR only → preserve existing unless user explicitly selects incoming — §5.9 table.
- [ ] **No UI for merging two already-persisted contact records** — explicitly deferred/out of scope — §5.9, §3.5.

## 11. Event Occurrence — `FR-MVP-OCC-001`
- [ ] Occurrence created transparently on every confirmed save; UI does not expose raw fields as user-editable except notes (contact ID, event ID, capturing user, timestamp, capture method, image ID, duplicate resolution, sync status are system-set) — §5.10.
- [ ] Occurrence history visible on contact detail screen — §5.12.

## 12. HighLevel Sync Status UX — `FR-MVP-GHL-001`
- [ ] Contact save success screen shows sync status: `synced` / `pending` / `failed` — §5.11, §6.2.
- [ ] Required messages: pending → "The contact is saved. HighLevel synchronization is still pending."; failed → "The contact is saved, but HighLevel synchronization failed. An administrator can retry." — §6.3.
- [ ] Admin-only retry action calling `POST /api/v1/contacts/{id}/ghl-sync` — §9.2, §6.2.
- [ ] Admin-only GHL installation/status screen (web only, not mobile) — §6.2, `MVP-015`.
- [ ] Installation flow triggers `GET /api/v1/integrations/highlevel/install`; OAuth callback handled server-side (`GET /oauth/callback/highlevel`, intentionally unversioned — registered exactly with HighLevel per §13.4) — frontend never handles/stores GHL tokens — §5.11, §13.4.
- [ ] **No GHL access/refresh tokens ever reach frontend code or state** — §5.11, §18.1.
- [ ] ⚠️ Any UI/flow touching HighLevel scopes, redirect URLs, or token handling requires mandatory human review — §14.7, `CLAUDE.md`.

## 13. Basic Retrieval — `FR-MVP-READ-001`
- [ ] Active event list — §5.12.
- [ ] Paginated contact list (`GET /api/v1/contacts`) — §5.12, §9.2.
- [ ] Contact detail with occurrence history (`GET /api/v1/contacts/{id}`) — §5.12, §9.2.
- [ ] Sync status visible in list/detail views.
- [ ] No dashboards, aggregate reports, or export UI built beyond this (out of MVP scope) — §3.5, §5.12.

## 14. Minimal Audit View (Optional, Should-Have)
- [ ] Admin-only minimal audit view — optional, Week 2 stretch if API is complete — §6.2. Do not prioritize over Must Have items.

## 15. Screen Inventory Checklist (Web) — §6.2
- [ ] Login
- [ ] Event list/select
- [ ] Event create/edit (Admin)
- [ ] Capture method chooser (Manual vs Business Card)
- [ ] Camera/gallery capture (browser file upload)
- [ ] Extraction progress (simple stage text)
- [ ] Review form
- [ ] Duplicate decision
- [ ] Contact list/detail
- [ ] GHL installation/status (Admin)
- [ ] Minimal audit view (Admin, optional)

## 16. Content & Error-Message Standards — §6.3
- [ ] All error/status copy matches the required message patterns table (invalid contact, file too large, extraction failed, duplicate found, GHL pending, GHL failed, session expired) verbatim or equivalently, always stating what happened, what the user can do, and whether data was preserved.

## 17. Accessibility Baseline — §6.4
- [ ] All controls labeled.
- [ ] Web forms fully keyboard-operable.
- [ ] Visible focus indicator.
- [ ] Sufficient text contrast per chosen design system.
- [ ] Error text programmatically associated with its field (e.g. `aria-describedby`).
- [ ] No color-only status communication (pair color with icon/text).
- [ ] Formal WCAG certification explicitly not required/claimed — §6.4.

## 18. Draft Preservation — §6.5
- [ ] In-progress capture draft may be retained in memory during normal navigation (non-sensitive fields only).
- [ ] Persistent local drafts (if built) are Should-Have only, and must never store access tokens or unencrypted image data.

## 19. API Contract Compliance — §9
- [ ] All API calls use HTTPS JSON, Bearer token from Supabase Auth session.
- [ ] Client reads/surfaces `correlation_id` from responses for support/debugging.
- [ ] Client renders the stable error object shape (`success`, `code`, `message`, `details[]`, `correlation_id`) consistently — §9.3.
- [ ] Idempotency key attached to every final capture submission — §9.4.
- [ ] Timestamps sent/displayed in UTC ISO 8601 — §9.1.
- [ ] Frontend consumes the generated typed client from the backend's versioned OpenAPI contract (per `CLAUDE.md` scope statement), not hand-written fetch calls to arbitrary endpoints.

## 20. Testing — §16
- [ ] Web component/unit tests: login, event selection, manual capture, image capture, review screen, duplicate state, save confirmation — §16.1.
- [ ] Each new route/component ships with at least one test referencing its requirement ID — `CLAUDE.md`.
- [ ] End-to-end scenarios covered where feasible on web (from §16.2): manual new contact; image+QR new contact; image+AI new contact; phone-match existing; email-match existing; phone/email point to different records (blocked); invalid image; OpenAI failure fallback; network retry without duplicate occurrence; GHL sync success; GHL sync failure with local save retained; unauthorized role access denied.

## 21. Security & Privacy (Frontend Responsibilities) — §18
- [ ] HTTPS-only origins for all calls.
- [ ] Only Supabase anon key + user session token used client-side — never service-role key — §8.5.
- [ ] No sensitive data (tokens, full API responses, raw images) written to browser console/logs in production builds.
- [ ] Privacy notice copy present in-app per §18.2 (contact/image processing, OpenAI transmission, HighLevel sync, lawful-basis requirement, retention period, no biometric ID).
- [ ] No PII sent to development/AI tooling during implementation — §14.8.
- [ ] Secret scan passes in CI; no secrets committed — `CLAUDE.md`, §18.1.

## 22. Explicitly Out of Scope — Do Not Build (Web) — §3.5
- [ ] Selfie capture/storage
- [ ] Facial recognition/biometrics
- [ ] PDF business cards
- [ ] Multi-OCR-provider routing/multilingual claims
- [ ] Full user-management UI, invitations, granular permission editor
- [ ] Viewer/Support/API Consumer/DevOps role UI
- [ ] Offline sync
- [ ] Push/email notifications, reminders, campaigns
- [ ] Persisted-contact merge UI
- [ ] Reports, PDF/XLSX export, dashboards, scheduled analytics (list + small count summary only is in-scope per repo `CLAUDE.md`)
- [ ] Any commercial-SLA-assuming feature (Vercel Hobby constraint) — repo `CLAUDE.md`

## 23. Release Exit Criteria (Frontend Portion) — §16.3, §20
- [ ] All Must Have (`MVP-001`…`MVP-021` web-relevant items) acceptance criteria pass or have a signed waiver.
- [ ] No open Critical defects; no open High defect in auth, contact integrity, duplicate logic, or data exposure paths.
- [ ] Secrets scan passes.
- [ ] Known limitations/free-tier risks acknowledged in release notes.
