# Contact Capture and Event Management System

## Deep Review, MVP Feasibility Study, Fact-Check, and Revamp Decision Record

| Document Control | Value |
|---|---|
| Review Version | 1.0 |
| Review Date | July 24, 2026 |
| Source Reviewed | Software Requirements Specification, Version 2.1, Human-AI Orchestration and Cost Edition |
| Review Perspective | Product Owner, Senior Technical Business Analyst, Project Manager, Senior Solutions Architect, Senior Software Engineer, UX Technical Writer, and Enterprise Documentation Specialist |
| Target Delivery | One-to-two-week pilot MVP |
| Target Cost Model | Two Claude Pro subscriptions, usage-capped OpenAI API, Vercel Hobby for non-commercial validation, and Supabase Free |
| Review Outcome | Conditionally feasible as a tightly scoped pilot; not feasible as the full enterprise release described in Version 2.1 |

---

## 1. Executive Review Conclusion

The source SRS is a strong enterprise planning document, but it is not a minimum viable product specification. It combines a full product roadmap, enterprise security and operations, three application surfaces, a multi-stage QR/OCR/AI pipeline, complex contact merging, detailed reporting, HighLevel contact and media synchronization, mobile marketplace release, extensive testing, ten sprints, and a large cross-functional team. Its own recommended duration is approximately twenty to twenty-four weeks, and its cost model assumes thousands of labor hours.

A one-to-two-week delivery can be credible only if the release is reclassified as a **pilot MVP** and the solution is reduced to one narrow business outcome:

> An authenticated staff user selects an event, captures a business card or enters contact data manually, reviews AI-proposed fields, saves one deduplicated contact with an event occurrence, and optionally synchronizes the approved contact to a HighLevel sub-account.

The revamp therefore preserves the source document’s defining business rules—mandatory human review, phone-first and email-second duplicate matching, one master contact with many event occurrences, and traceable integration activity—while removing or deferring enterprise-scale features and infrastructure.

### 1.1 Final Architecture Decision

**Use PostgreSQL in development, staging, and pilot production.**

- Local development uses the Supabase CLI and its containerized local PostgreSQL stack.
- Staging uses Supabase Free Project 1.
- Pilot production uses Supabase Free Project 2.
- SQLite is permitted only for isolated unit tests that do not validate SQL behavior, migrations, row-level security, locking, JSONB, UUIDs, or integration behavior.
- SQLite shall not be the shared development database and shall not be used for staging.

This decision avoids database-dialect drift and preserves parity with Supabase’s PostgreSQL, Auth, Storage, and Row Level Security capabilities.

### 1.2 Feasibility Decision by Requested Item

| Requested Item | Decision | Feasibility Result |
|---|---|---|
| Convert the current SRS to an MVP | Approved with major scope reduction | Feasible in two weeks; a five-day demo is possible only with further exclusions |
| SQLite for development/staging or PostgreSQL in all environments | Select PostgreSQL everywhere | Recommended and feasible |
| Supabase Free PostgreSQL | Use two hosted projects plus local development | Feasible for a small pilot, with strict quota, backup, inactivity, and no-SLA caveats |
| Vercel Free | Use only for personal/non-commercial demo or internal validation | Technically feasible; not compliant for a commercial marketplace production service under current Hobby terms |
| Android without public publishing | Signed APK and one-time redemption link; or Google internal sharing if the $25 account fee is approved | Feasible |
| iOS without public publishing | Simulator/free Personal Team for limited testing; TestFlight or Ad Hoc requires Apple Developer membership | Conditionally feasible; arbitrary direct install by a one-time link is not feasible without Apple signing/provisioning |
| One-time downloadable install link | Build an application-controlled redemption link for Android; use TestFlight or registered-device Ad Hoc for iOS | Partially feasible; a store link is not truly single-use |
| Kiro Spec-Driven Development in Claude Code | Use a reviewed community Kiro-inspired Claude Code skill, pinned to a commit | Feasible without an AWS Kiro IDE subscription; it is not the same product as official Kiro IDE |
| Two Claude Pro accounts | One named account per human contributor | Feasible at $40 for one month before tax; usage limits still apply |
| OpenAI API | Use a project-level budget cap and a vision-capable model with structured output | Feasible; cost is usage-dependent |
| GoHighLevel Marketplace install for Agency and Sub-Accounts | Private app, target user Sub-account, installable by Agency and Sub-account, tested through a test link | Feasible for pilot; public Marketplace approval is post-MVP and cannot be guaranteed in two weeks |
| Three repositories | Backend, web frontend, mobile | Feasible and recommended |

---

## 2. Review of the Source SRS

## 2.1 What the Source Document Does Well

The source document contains several product rules that should remain unchanged:

1. **Human confirmation is mandatory.** Automated extraction is proposed data, not final truth.
2. **Phone number is the first duplicate key; email is second.**
3. **One master contact can have many event occurrences.**
4. **Repeat interactions must not create unnecessary duplicate contacts.**
5. **Conflicting automated values must not silently overwrite verified values.**
6. **Authentication, authorization, input validation, auditability, and protected secrets are required.**
7. **AI-assisted engineering requires named human ownership and review.**

These principles remain in the MVP SRS because they represent the core business value and the minimum acceptable control environment.

## 2.2 Why the Current Scope Is Not a One-to-Two-Week MVP

The source SRS includes the following categories that collectively exceed the requested delivery window:

- Full user administration and granular RBAC
- Web, Android, and iOS release readiness
- Business-card and selfie management
- QR-first processing, OCR fallback, multilingual routing, AI normalization, confidence scoring, and provider fallback
- Advanced duplicate review and contact merge
- Reporting, exports, notifications, dashboards, and extensive audit views
- AWS WAF, ALB, EC2 Auto Scaling, SQS, RDS, S3, CloudWatch, Secrets Manager, and disaster recovery
- HighLevel as a canonical contact and media platform with an outbox/saga and reconciliation process
- One thousand concurrent users, 99.9% availability, RTO/RPO commitments, load testing, and broad accessibility coverage
- Ten sprints and a large specialist team
- Public mobile marketplace release and enterprise operational handover

The issue is not that these capabilities are invalid. The issue is that they represent a production-scale initial release rather than a demonstrable MVP.

## 2.3 Source-to-MVP Scope Reduction

| Source Capability | MVP Treatment | Reason |
|---|---|---|
| Username/email/password authentication and custom refresh-token service | Replace with Supabase Auth email/password | Removes a security-sensitive custom subsystem |
| Administrator, Staff, Viewer, Support, API Consumer, DevOps roles | Reduce to Admin and Staff | Sufficient for pilot workflow |
| Full user-management module | Defer; users are invited/managed in Supabase dashboard or minimal admin screen | Saves implementation and testing time |
| Selfie upload | Remove from MVP | Not needed to prove contact-capture value and adds privacy obligations |
| JPG, PNG, PDF | JPG/PNG only | Avoids PDF parsing and page handling |
| QR first, OCR providers, AI merge pipeline | Use OpenAI vision structured extraction, with manual fallback | Removes provider orchestration while retaining automation |
| Japanese and Chinese OCR commitments | Defer and do not claim | Requires representative accuracy validation |
| Background queues, workers, retries, dead-letter queues | Synchronous processing with bounded timeout and visible retry | Appropriate for low-volume pilot |
| Full contact merge interface | Deterministic match plus simple field confirmation | Enough to prevent common duplicates |
| Reporting and exports | Contact/event lists and a small count summary only | Not part of primary value hypothesis |
| Notifications and push | Defer | No MVP dependency |
| HighLevel as canonical contact/media store | Supabase is pilot source of truth; sync approved contacts to HighLevel | Reduces distributed consistency risk |
| HighLevel Media API | Defer | Supabase Storage is already available and simpler |
| AWS infrastructure | Remove | Conflicts with requested Vercel/Supabase free baseline |
| 1,000 concurrent users and 99.9% SLA | Replace with pilot capacity and best-effort service | Free plans do not support enterprise SLA commitments |
| Public App Store/Play publication | Internal/sideload validation only | User specifically requested no public publication |
| Ten sprints / 20–24 weeks | Ten working-day plan with a Day-5 demo gate | Aligns with requested schedule |
| $330K+ labor model | Separate internal labor from direct tool cash | User requested a limited tool-purchase budget |

---

## 3. Database Architecture Review

## 3.1 Options Considered

### Option A — SQLite for Development and Staging, PostgreSQL for Production

This option is rejected for the shared environments. SQLite is useful for embedded applications, prototypes, and isolated unit tests, but it would create material parity problems here:

- Supabase is PostgreSQL, not SQLite.
- PostgreSQL Row Level Security cannot be meaningfully validated in SQLite.
- PostgreSQL JSONB, UUID generation, partial indexes, locking, concurrency, extensions, and SQL semantics differ.
- Migration scripts can pass locally and fail in staging/production.
- HighLevel OAuth installation and concurrent contact writes require realistic transactional behavior.
- A staging environment using SQLite would not validate the production database.

### Option B — PostgreSQL for Development, Staging, and Pilot Production

This option is selected. Supabase officially supports local development through its CLI and a container runtime, which provides a local PostgreSQL-based stack. The same schema and migrations can then be promoted to two hosted Supabase projects. [FC-04]

## 3.2 Selected Environment Model

| Environment | Database | Purpose | Data Policy |
|---|---|---|---|
| Local development | Local Supabase/PostgreSQL via CLI and containers | Coding, migrations, unit and integration tests | Synthetic data only |
| Shared staging | Supabase Free Project 1 | Integrated QA, HighLevel sandbox, mobile validation | Synthetic or approved test data |
| Pilot production | Supabase Free Project 2 | Small controlled pilot | Minimum necessary real data with explicit acceptance of free-plan risks |

## 3.3 Supabase Free Fact-Check

As of the review date, Supabase’s official pricing page states that the Free plan includes two active projects, 500 MB database size per project, shared CPU and 500 MB RAM, 5 GB egress, 1 GB file storage, and 50,000 monthly active users. Free projects may be paused after one week of inactivity. [FC-01]

Important limitations for this MVP are:

- **Two-project ceiling:** the plan is sufficient for staging and pilot production while local development runs locally. [FC-01]
- **Database quota:** a free project enters read-only mode after exceeding the 500 MB database-size quota. [FC-02]
- **Storage quota:** 1 GB of file storage is included, so images require compression, retention limits, and monitoring. [FC-01]
- **No automatic backups:** daily automatic backups are available on paid plans, not the Free plan. Supabase recommends regular `supabase db dump` exports and off-site backups for Free projects. [FC-03]
- **Inactivity pause:** low-activity Free projects may be paused after approximately seven days. [FC-01]
- **No uptime SLA or enterprise support:** the pilot must not claim 99.9% availability or production support guarantees. [FC-01]

### Required Compensating Controls

1. Run a database-size and storage-size check before every release and at least twice weekly during the pilot.
2. Compress business-card images and enforce a 10 MB upload limit; target normal files below 2 MB.
3. Retain source images for thirty days by default, then delete unless explicitly retained.
4. Run an encrypted logical database dump before every release and daily while the pilot has active real data.
5. Maintain a separate export procedure for Supabase Storage because database backups do not restore deleted storage objects. [FC-03]
6. Establish a paid-plan upgrade trigger at 350 MB database use, 750 MB storage use, repeated pauses, or any requirement for an SLA or automatic backups.

---

## 4. Application Deployment Review

## 4.1 Vercel Feasibility

Vercel officially supports deploying FastAPI through its Python runtime and ASGI entrypoint model, so the proposed Next.js frontend and FastAPI backend can technically be deployed as two separate Vercel projects. [FC-05]

However, Vercel’s current terms state that Hobby-plan services may be used only for personal or non-commercial use. [FC-06]

### Decision

- Vercel Hobby is approved for a personal proof of concept, internal technical validation, or a non-commercial pilot.
- Vercel Hobby is **not approved as the commercial production host** for a paid HighLevel Marketplace application or a client-facing commercial service.
- Before commercial launch or monetized Marketplace distribution, the project must pass a hosting gate and move to Vercel Pro or another commercial-use-compatible host.

This is a legal/contractual plan restriction, not merely a performance recommendation. The revised SRS therefore describes Vercel Hobby as a **pilot deployment baseline**, not a production SLA platform.

## 4.2 Proposed Pilot Deployment

| Component | Repository | Pilot Deployment |
|---|---|---|
| Next.js web application | `contact-capture-web` | Vercel Hobby project; preview and main deployments |
| FastAPI backend | `contact-capture-backend` | Separate Vercel Hobby project using Python runtime |
| PostgreSQL, Auth, Storage | Backend-owned schema | Supabase Free staging and pilot projects |
| React Native application | `contact-capture-mobile` | Locally signed builds; direct Android distribution; conditional iOS distribution |
| Runtime AI | Backend integration | OpenAI API; key held only by backend |
| HighLevel | Backend integration | Private Marketplace app and sandbox/test link |

## 4.3 Serverless Design Constraints

The MVP shall avoid queue workers, persistent processes, local-disk reliance, and long-running tasks. A business-card extraction request should normally complete within thirty seconds. The mobile/web client must display an error and allow manual entry when the provider or function times out.

Images should be uploaded directly to private Supabase Storage using a backend-authorized upload flow. The API receives only the storage object reference when practical, reducing request-body pressure and duplicate transfers.

---

## 5. Mobile Validation and Non-Public Distribution Feasibility

## 5.1 Android

### Path A — Strict-Budget Direct APK Distribution

1. Build a signed release APK.
2. Store it in a private Supabase Storage bucket.
3. Create a backend `download_tokens` record with a random token hash, expiry, platform, build version, and `max_downloads = 1`.
4. The tester opens a redemption URL.
5. The backend atomically marks the token redeemed and returns a short-lived signed file URL.
6. The tester enables installation from the applicable unknown-app source and installs the APK.

This is feasible without publishing to Google Play. The one-time property is enforced by the application’s redemption service, not by Android or a store. A tester who already downloaded the APK may copy it, so the control limits link redemption rather than guaranteeing artifact non-transferability.

### Path B — Google Play Internal App Sharing or Internal Testing

Google’s Internal App Sharing accepts an APK or Android App Bundle and generates a link that can be restricted to email lists or shared with anyone who has the link. Internal testing supports up to 100 testers. [FC-07] [FC-08]

A Play Console account requires a one-time US$25 registration fee. [FC-09]

This path does not publicly publish the app, but the generated link is not a native single-use link. It is also outside the strict “only two Claude Pro accounts and OpenAI API” purchase list unless the $25 fee is separately approved.

### Android Recommendation

Use direct signed APK distribution for the strict-budget MVP. Use Play Internal App Sharing only when stakeholders want to validate the exact Google Play-delivered artifact and approve the account fee.

## 5.2 iOS

Apple’s distribution model does not permit an arbitrary unsigned iOS app to be installed from a generic one-time URL.

### Available Paths

| Path | Fee | Devices/Users | Expiry/Review | Suitability |
|---|---:|---|---|---|
| iOS Simulator | $0 | Simulator on a Mac | No store distribution | Required baseline validation |
| Xcode Personal Team | $0 | Up to 3 devices per platform; App IDs and provisioning expire after 7 days | Requires rebuild/reinstall; personal testing | Very limited physical-device validation |
| TestFlight | Apple Developer Program | Up to 100 internal and 10,000 external testers | Builds testable for up to 90 days; first external build may require beta review | Recommended non-public beta distribution |
| Ad Hoc | Apple Developer Program | Registered devices, subject to Apple device limits | Devices must be registered and build signed | Feasible for a small known device list |

Apple states that the Apple Developer Program costs US$99 per membership year. A free Personal Team is limited to ten App IDs, three test devices per platform, and seven-day provisioning profiles. [FC-10]

TestFlight supports non-public beta testing, allows builds to be tested for up to ninety days, permits up to one hundred internal testers and ten thousand external testers, and may require review for the first external build. [FC-11]

### iOS Recommendation

- In the strict-budget path, deliver an iOS simulator build and validate on a developer-owned device through a free Personal Team when a Mac and physical iPhone are available.
- For stakeholder-friendly physical-device installation, approve the $99 Apple Developer Program fee and use TestFlight.
- A one-time application-controlled link may gate download of an Ad Hoc IPA, but installation still requires a properly signed build and a pre-registered device. The link does not replace Apple provisioning.

## 5.3 Mobile Go/No-Go Dependencies

Physical mobile validation within ten working days requires:

- A working Android device
- Android signing-key ownership and secure storage
- A macOS machine with current Xcode for iOS
- At least one supported iPhone for physical iOS testing
- Apple account access, and Apple Developer membership if TestFlight or Ad Hoc is selected
- Timely camera/photo permission testing
- No late changes to application identifiers or signing ownership

---

## 6. Human and AI Role Orchestration Review

## 6.1 Problem in the Source Model

The source SRS defines a broad RACI with many specialist roles. That is appropriate for an enterprise release but not credible for a one-to-two-week MVP funded around two Claude Pro accounts. Retaining a large role chart would create documentation theater: many accountabilities would exist on paper without actual people to perform them.

## 6.2 Selected Two-Human Model

Each Claude Pro subscription is assigned to one named human. Credentials shall not be shared.

| Human | Combined Responsibilities | Authority Retained by the Human |
|---|---|---|
| Human A — Product/Architecture/Backend Lead | Product ownership, business analysis, architecture, database, FastAPI, OpenAI, HighLevel integration, release scope | Scope, architecture, data model, integration design, acceptance, security exceptions |
| Human B — Web/Mobile/QA/Delivery Lead | Next.js, React Native, UX, CI, deployment, test automation, exploratory QA, release documentation | UX implementation, client architecture, test sufficiency, signing/build validation, deployment readiness |

A client representative remains required for business acceptance but is not treated as a purchased software seat.

## 6.3 AI Roles

| AI Role | Permitted Work | Prohibited Authority |
|---|---|---|
| Specification assistant | Draft requirements, EARS acceptance criteria, task breakdowns, change summaries | Cannot approve scope or resolve business ambiguity without a human |
| Implementation assistant | Scaffold code, implement bounded tasks, refactor, write migrations and tests | Cannot merge, deploy, handle production secrets, or approve its own code |
| Review assistant | Identify defects, missing cases, risky changes, and traceability gaps | Cannot be the only reviewer |
| Documentation assistant | Draft API docs, runbooks, release notes, and user instructions | Cannot certify legal, security, privacy, or store compliance |
| Runtime extraction model | Propose structured contact fields from a card image | Cannot save final contact values without user review |

## 6.4 Kiro Spec-Driven Development Fact-Check

The official Kiro product is a separate IDE with its own plans. [FC-12]

There are also community-maintained Claude Code skills and plugins that implement a Kiro-inspired requirements → design → tasks → implementation workflow. For example, public GitHub projects provide Claude Code skills, slash commands, hooks, and `.kiro/specs`-style structures. [FC-13]

Therefore, the requested approach is feasible with the following correction:

> The MVP will use a reviewed, community-maintained Kiro-inspired Spec-Driven Development skill inside Claude Code. It does not require an AWS Kiro IDE subscription, but it must not be represented as an official entitlement or supported feature of AWS Kiro unless the selected tool is actually supplied by Kiro.

Required controls:

1. Select one repository and license after human review.
2. Pin the selected version or commit; do not install unpinned code during delivery.
3. Review hooks and shell permissions before enabling them.
4. Store generated specs in each repository under `.kiro/specs/` or `docs/specs/`.
5. Require approval after requirements, design, and tasks before implementation.
6. Do not give the skill production credentials or unrestricted shell access.

## 6.5 Claude Pro Fact-Check

Anthropic’s official help center lists Claude Pro at US$20 per month and states that Claude Code can be used under the unified Pro subscription. API usage is billed separately and is not included merely because a user has Pro. [FC-14] [FC-15]

Two monthly Pro subscriptions therefore create a direct subscription baseline of **US$40 before taxes or regional pricing**. Pro plans have usage limits, so the one-to-two-week schedule must include a fallback to ordinary human development when a limit is reached. The budget does not include Claude API usage.

## 6.6 Four-Eyes Rule

The following changes require approval by the other human before merge:

- Authentication or authorization changes
- Database migrations and Row Level Security policies
- OpenAI or HighLevel data-sharing changes
- OAuth token handling and encryption
- Mobile signing configuration
- Secrets and environment changes
- Production/pilot deployment
- Any change that can overwrite or merge contact data

---

## 7. GoHighLevel Marketplace Feasibility Study

## 7.1 Recommended Marketplace Configuration

| Field | MVP Selection |
|---|---|
| App type | Private |
| Target user | Sub-account |
| Who can install | Both Agency and Sub-account / Everyone |
| Listing | Not publicly listed during MVP |
| Bulk installation | Enable when available and test with one Agency and selected Sub-Accounts |
| Core scopes | Minimum Contacts read/write plus only scopes required for install identity and lifecycle events |
| Source of truth | Supabase for pilot; HighLevel receives approved contact synchronization |

HighLevel’s official documentation recommends starting as a Private app for development/testing, identifies Sub-account as the recommended target for most location-level apps, and supports installation by both Agency and Sub-account users. [FC-16]

## 7.2 Installation and Token Behavior

When an Agency user installs a Sub-account-targeted app, the OAuth exchange returns a Company-level token. The integration must exchange that token for a Location-level token before calling Sub-account APIs. When a Sub-account user installs, the result is a Location-level token that can be used directly. [FC-17]

Access tokens last approximately one day. Refresh tokens last up to one year or until used; refresh-token rotation must be persisted atomically. Current published rate limits are 100 requests per ten seconds and 200,000 requests per day per app per Location or Company resource. [FC-18]

## 7.3 Testing Without Public Marketplace Publication

HighLevel supports generating a test link for a specific private app version and a specific Location ID in a sandbox/test account. The link installs that version into the selected Location for validation of OAuth, API calls, webhooks, and app behavior. [FC-19]

This makes a private Marketplace pilot feasible within the two-week target when sandbox and developer access are available on Day 1.

## 7.4 Private-App Distribution Limit

For private apps created on or after November 18, 2025, HighLevel’s published policy limits an unreviewed private app to five Agencies. Sub-accounts under an Agency do not count separately. At six or more Agencies, new installs are blocked until the app is made public or passes the applicable Security Review. [FC-20]

This is compatible with a pilot in one Agency and multiple Sub-Accounts, but it is not a long-term public distribution strategy.

## 7.5 MVP Integration Scope

Included:

- OAuth authorization callback
- Company and Location token handling
- Token encryption at rest using an application encryption key stored in Vercel environment settings
- Install and uninstall lifecycle tracking
- Refresh-token rotation
- Create/update or upsert approved contact data in one or more authorized Locations
- Local-to-HighLevel mapping and last-sync status
- Manual retry for a failed synchronization

Deferred:

- HighLevel Media Storage API
- Public Marketplace listing and approval
- Paid-app billing, reseller flows, or revenue share
- Workflow actions and triggers
- Cross-Agency administration portal
- Large-scale bulk synchronization
- Automated reconciliation workers
- Marketplace analytics and monetization

---

## 8. Three-Repository Review

## 8.1 Repository Structure

### Repository 1 — `contact-capture-backend`

Owns:

- FastAPI API
- Supabase/PostgreSQL schema and migrations
- Supabase JWT validation
- OpenAI extraction adapter
- HighLevel OAuth and contact synchronization
- Download-token service
- OpenAPI contract
- Backend tests and deployment configuration

### Repository 2 — `contact-capture-web`

Owns:

- Next.js application
- Login/session UX
- Event and contact forms
- Image upload and review UX
- Contact/event lists
- HighLevel connection status and manual sync action
- Generated API client
- Web tests and Vercel deployment configuration

### Repository 3 — `contact-capture-mobile`

Owns:

- React Native application, preferably using Expo-compatible libraries where they do not block local signed builds
- Camera/gallery capture
- Event selection
- Review/edit/save flow
- Generated API client
- Android build and install documentation
- iOS simulator and conditional signed-build configuration
- Mobile tests

## 8.2 Contract and Release Coordination

A fourth shared repository is not required. The backend publishes the versioned OpenAPI specification. The web and mobile repositories generate typed clients from a tagged backend contract. A release manifest records compatible versions:

```text
backend: v0.1.0
web: v0.1.0
mobile: v0.1.0
api-contract: 0.1
schema: 0001_initial_mvp
```

Each repository contains its own Kiro-inspired specs and a project-level `CLAUDE.md`. Cross-repository requirements use the same requirement ID.

---

## 9. One-to-Two-Week Delivery Feasibility

## 9.1 Capacity Assumption

The recommended plan assumes:

- Two experienced full-time contributors
- Ten working days
- Approximately 160 combined person-hours before meetings and interruptions
- Stable requirements at Day 1
- Existing or immediately available Supabase, Vercel, OpenAI, GitHub, HighLevel sandbox, Android, and Apple development access
- Daily client decisions within hours, not days

This schedule is not feasible for one part-time developer, the full source scope, public marketplace approval, or a production-grade SLA.

## 9.2 Ten-Day Plan

| Day | Primary Outcome | Exit Evidence |
|---:|---|---|
| 1 | Scope freeze, three repositories, Kiro-style specs, local Supabase, hosted staging/pilot projects, CI skeleton | Repositories build; schema migration applies locally and to staging |
| 2 | Supabase Auth, roles, events, contacts, event occurrences, backend CRUD | Authenticated API and database integration tests pass |
| 3 | Web and mobile login, event selection, manual contact capture | Manual capture works end to end on web and one mobile target |
| 4 | Private image upload and OpenAI structured extraction | JPG/PNG produces editable proposed fields or manual fallback |
| 5 | Review UX, validation, phone-first/email-second matching, occurrence creation | **MVP demo gate:** core capture workflow accepted |
| 6 | HighLevel private app configuration and OAuth callback | App installs to sandbox Location; tokens stored encrypted |
| 7 | HighLevel contact synchronization and mapping | Approved contact sync succeeds and retry is visible |
| 8 | Android signed build and one-time redemption link; iOS simulator/free-device validation | Install/run evidence and permission tests |
| 9 | UAT, security review, backup/restore drill, defects | Critical scenarios pass; no open blocker defects |
| 10 | Release candidate, pilot deployment, runbook, handover, acceptance | Signed acceptance or documented residual risks |

## 9.3 Five-Day Demo Variant

A five-day demonstration may include only:

- Web application
- Android developer build or emulator
- Manual and image-assisted capture
- Supabase Auth/Database/Storage
- OpenAI extraction
- Duplicate detection and event occurrence

HighLevel Marketplace installation, physical iOS distribution, production data, and formal operational hardening are deferred.

---

## 10. Direct Tool Budget

## 10.1 Strict Requested Budget

| Item | Quantity | Planning Cost | Notes |
|---|---:|---:|---|
| Claude Pro | 2 accounts × 1 month | $40 | US list price before taxes/region differences; includes Claude Code access, not Claude API |
| OpenAI API | One billing project, separate staging/pilot keys | $50 recommended cap | Suggested range $25–$100; actual usage depends on images, prompt size, model, and retries |
| Supabase Free | Local + 2 hosted projects | $0 | Subject to quotas, pausing, no automatic backups, and no SLA |
| Vercel Hobby | 2 projects | $0 | Non-commercial/personal use only under current terms |
| Community Kiro-inspired Claude Code skill | Pinned open-source package/repository | $0 | License and code must be reviewed |
| **Recommended strict direct cash total** |  | **$90** | Excludes labor, taxes, domain, store accounts, and existing HighLevel subscription |

Recommended OpenAI controls:

- Start with a $50 project budget.
- Alert at 50%, 80%, and 100%.
- Use separate restricted keys for staging and pilot.
- Do not place the key in web or mobile applications.
- Use a configurable vision-capable model supporting structured output.
- Record per-request token use and estimated cost when returned by the API.

## 10.2 Conditional Mobile Costs Not Included in the Strict Budget

| Optional Item | Official Cost | Trigger |
|---|---:|---|
| Google Play Console | $25 one-time | Required for Play Internal App Sharing or test tracks if no existing account is available |
| Apple Developer Program | $99/year | Required for TestFlight, Ad Hoc distribution, and normal app distribution |

With both optional accounts and the recommended OpenAI cap, the direct first-year cash total is approximately **$214 before taxes**, assuming no existing developer accounts.

## 10.3 Labor Treatment

Internal labor is not assigned a cash price in the revamped SRS because the requested budget is defined by tool purchases. The schedule nevertheless assumes two full-time experienced people. The absence of a labor line does not mean the work has no labor cost.

---

## 11. Revised Pilot Success Metrics

| Metric | MVP Target |
|---|---|
| Critical workflow | Authenticated user can save a reviewed contact and event occurrence through web and mobile |
| Manual capture | 100% of valid test cases save successfully |
| Image extraction | At least 80% of representative English-language cards produce one or more useful proposed fields; no guarantee of full accuracy |
| Human review | 100% of automated values remain editable before save |
| Duplicate detection | Exact normalized phone checked first; email checked second when no phone match exists |
| Event history | Every successful capture creates an event occurrence |
| HighLevel pilot sync | At least 95% of valid test syncs succeed or expose a retryable status |
| Pilot capacity | Up to 25 concurrent users, 1,000 contacts, and 500 retained images, subject to free-plan quotas |
| Security | No secrets in repositories or clients; RLS and authorization tests pass; no unresolved critical finding |
| Recovery | Database dump and restore procedure demonstrated; target RPO is 24 hours for pilot |
| Mobile | Android physical-device validation completed; iOS simulator completed and physical-device path documented or completed if credentials exist |

---

## 12. Principal Risks and Mitigations

| Risk | Rating | Mitigation / Decision |
|---|---|---|
| One-to-two-week scope expands toward the original SRS | Critical | Freeze MVP scope; additions replace existing work or move to post-MVP |
| Vercel Hobby used commercially | Critical | Restrict to non-commercial pilot; require hosting upgrade before commercial launch |
| Free Supabase project exceeds quota or pauses | High | Monitor usage, keep pilot active, define upgrade threshold, maintain exports |
| Free Supabase has no automatic backups | High | Daily logical dump and separate storage export while real pilot data exists |
| iOS tester expects a generic one-click URL | High | Explain provisioning; use TestFlight with paid membership or free developer-device testing |
| HighLevel credentials or sandbox arrive late | High | Mock adapter through Day 5; integration becomes conditional Day 6–7 scope |
| HighLevel private app grows beyond five Agencies | Medium/High | Public listing or Security Review before the sixth Agency |
| Claude Pro usage limits slow delivery | Medium | Human fallback, narrow prompts, use sessions efficiently, do not make AI a critical-path approver |
| Community Kiro skill executes unsafe hooks | High | Pin, inspect, minimize tool permissions, and test in a disposable branch |
| AI extraction is inaccurate | High | Mandatory review, deterministic field validation, manual entry fallback |
| OpenAI key leaks to mobile/web | Critical | Backend-only key, secret scanning, Vercel environment variables, rotate on suspicion |
| OAuth refresh-token race causes invalid token | High | Transactional token rotation and per-install lock/version check |
| Two people cannot provide independent specialist assurance | Medium | Four-eyes review on critical changes; document residual risk and obtain external review before broader launch |

---

## 13. Final Self-Review

The revamped SRS and this review were checked against the following items:

- [x] The core business workflow from the source document is preserved.
- [x] PostgreSQL is selected for development, staging, and pilot production.
- [x] SQLite is explicitly limited to optional isolated unit tests.
- [x] Supabase Free quotas, project count, inactivity pause, read-only threshold, storage limit, lack of automatic backups, and no-SLA implications are documented.
- [x] Vercel FastAPI feasibility is confirmed.
- [x] Vercel Hobby’s non-commercial restriction is explicitly disclosed rather than hidden.
- [x] Android direct distribution, Play internal distribution, and the Play Console fee are distinguished.
- [x] iOS simulator, free Personal Team, TestFlight, and Ad Hoc options are distinguished.
- [x] The one-time-link claim is limited to redemption control and does not claim to bypass Android or Apple security.
- [x] The Kiro-inspired Claude Code skill is described as community-maintained, not official AWS Kiro IDE access.
- [x] Only two Claude Pro accounts are budgeted.
- [x] OpenAI API use is separately budget-capped.
- [x] HighLevel private app, test link, Agency versus Location token behavior, private-app Agency cap, and public-listing boundary are documented.
- [x] The solution uses exactly three code repositories.
- [x] The ten-working-day plan has a Day-5 core-value gate and explicit assumptions.
- [x] Enterprise features removed from the MVP are captured as post-MVP work rather than silently discarded.
- [x] The document does not claim production-grade uptime, backups, scale, public-store approval, or marketplace approval under free plans.

## 13.1 Final Recommendation

Proceed with a **two-week controlled pilot**, not a commercial production launch, under these mandatory conditions:

1. Scope is frozen to the revised MVP.
2. Two experienced contributors are available full time.
3. HighLevel sandbox/developer access and mobile build prerequisites are available on Day 1.
4. Vercel Hobby is used only in a manner permitted by its non-commercial terms.
5. A paid hosting decision is made before any commercial Marketplace launch.
6. Stakeholders accept Supabase Free’s no-SLA and no-automatic-backup limitations.
7. Physical iOS distribution is either limited to free developer testing or separately funded through Apple Developer membership.

Without these conditions, the one-to-two-week target should be treated as a prototype demonstration rather than an accepted MVP release.

---

# Fact-Check References

All references were accessed July 24, 2026. Product plans, prices, quotas, and policies can change and must be revalidated before purchase or launch.

- **[FC-01] Supabase — Pricing & Fees.** https://supabase.com/pricing
- **[FC-02] Supabase — Understanding Database and Disk Size.** https://supabase.com/docs/guides/platform/database-size
- **[FC-03] Supabase — Database Backups.** https://supabase.com/docs/guides/platform/backups
- **[FC-04] Supabase — Local Development & CLI.** https://supabase.com/docs/guides/local-development
- **[FC-05] Vercel — Deploy a FastAPI App on Vercel / Python Runtime.** https://vercel.com/docs/frameworks/backend/fastapi
- **[FC-06] Vercel — Terms of Service, Hobby Plan.** https://vercel.com/legal/terms
- **[FC-07] Google Play Console Help — Share App Bundles and APKs Internally.** https://support.google.com/googleplay/android-developer/answer/9844679
- **[FC-08] Google Play Console Help — Set Up an Internal Test.** https://support.google.com/googleplay/android-developer/answer/9845334
- **[FC-09] Google Play Console Help — Get Started with Play Console.** https://support.google.com/googleplay/android-developer/answer/6112435
- **[FC-10] Apple Developer — Choosing a Membership.** https://developer.apple.com/support/compare-memberships/
- **[FC-11] Apple Developer — TestFlight Overview.** https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview
- **[FC-12] Kiro — Pricing and IDE Documentation.** https://kiro.dev/pricing/ and https://kiro.dev/docs/specs/
- **[FC-13] Community Claude Code Kiro-style skills.** https://github.com/angelsen/claude-kiro and https://github.com/jasonkneen/kiro/tree/main/skills
- **[FC-14] Anthropic — What Is the Claude Pro Plan?** https://support.claude.com/en/articles/8325606-what-is-the-pro-plan
- **[FC-15] Anthropic — Use Claude Code with Your Pro or Max Plan.** https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan
- **[FC-16] HighLevel — Create a Marketplace App / App Distribution Model.** https://marketplace.gohighlevel.com/docs/oauth/CreateMarketplaceApp/index.html and https://marketplace.gohighlevel.com/docs/oauth/AppDistribution/index.html
- **[FC-17] HighLevel — Handling Access Tokens for Apps with Target User: Sub-Account.** https://marketplace.gohighlevel.com/docs/Authorization/TargetUserSubAccount/index.html
- **[FC-18] HighLevel — OAuth FAQ and Token Limits.** https://marketplace.gohighlevel.com/docs/oauth/Faqs/index.html
- **[FC-19] HighLevel — Installing and Testing a Marketplace App.** https://marketplace.gohighlevel.com/docs/oauth/TestingApp/index.html
- **[FC-20] HighLevel — Private App Distribution Limit.** https://marketplace.gohighlevel.com/docs/MarketplacePolicies/PrivateAppInstallLimits/index.html
- **[FC-21] OpenAI — API Pricing.** https://developers.openai.com/api/docs/pricing
- **[FC-22] OpenAI — Images and Vision / Structured Outputs.** https://developers.openai.com/api/docs/guides/images-vision and https://developers.openai.com/api/docs/guides/structured-outputs
