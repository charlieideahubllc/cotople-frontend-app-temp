# Claude Code Operating Rules — cotople-frontend-app

## Scope
This file governs how Claude Code (and other AI coding assistants) operate in this repository. It supplements, and does not replace, the steering documents in `.kiro/steering/`.

## Knowledge Base
`Contact_Capture_Event_Management_MVP_SRS_v3.0.md` (in this repo root) is the authoritative source for scope, requirements, architecture, and requirement IDs for this pilot MVP. The prior enterprise-scale SRS (`Software_Requirements_Specification_FINAL_v3.md`) has been removed from this repo; do not reference or recreate it. `Contact_Capture_Event_Management_MVP_Review_and_Fact_Check.md` is the paired feasibility/fact-check record explaining *why* scope was cut and documenting provider-specific constraints (Supabase, Vercel, HighLevel, Apple, Google, Anthropic, OpenAI). Consult both before writing or reviewing requirements-linked code, and use MVP SRS requirement IDs (not invented ones) in commits, PRs, and tests. If a Kiro spec conflicts with the MVP SRS, flag the discrepancy to the user rather than silently picking one.

### MVP Pilot Scope — Web (`contact-capture-web`)
This repo owns: the Next.js app, login/session UX (backed by Supabase Auth), event and contact forms, business-card image upload + AI-proposed-field review UX, contact/event list views, HighLevel connection status and manual "sync now" action, and the generated typed API client from the backend's versioned OpenAPI contract.

Binding decisions for this repo:
- **Deployment:** Vercel Hobby project. Hobby is legally restricted to **non-commercial/personal use** — this app must not be positioned as a commercial production host for a paid HighLevel Marketplace app or client-facing commercial service until a hosting-plan upgrade gate is passed. Don't build features that assume a commercial SLA.
- **Auth:** Supabase Auth email/password; no custom JWT/refresh-token UI. Only Admin and Staff roles exist in MVP — don't build UI for Viewer/Support/API Consumer/DevOps.
- **Image upload:** JPG/PNG only, uploaded directly to private Supabase Storage (not proxied through the Vercel Function body) to stay under Vercel's ~4.5 MB request-body limit. Card capture is required; selfie capture is out of MVP scope.
- **AI review UX:** every OpenAI-proposed field must remain editable and require explicit user confirmation before save — proposed values are never auto-committed. Duplicate detection is phone-first, email-second (exact normalized match); ambiguous matches must not silently auto-merge.
- **Out of MVP scope for this repo:** full reporting/exports/dashboards (list + small count summary only), notifications/push, full contact-merge UI (deterministic match + simple field confirmation only), multilingual OCR UI claims.
- **HighLevel UX:** show connection/install status and a manual retry action for failed syncs; do not build cross-Agency admin UI, workflow/trigger UI, or billing UI (all deferred).

## Coding Standards
- Follow `.kiro/steering/project-standards.md`, `git-workflow.md`, and `frontend-standards.md`.
- TypeScript strict mode, no unexplained `any`, ESLint/Prettier clean before proposing a commit.
- New routes/components ship with at least one test referencing the requirement ID it verifies.
- No new dependency added without checking it against existing alternatives already in the project.

## Mandatory Human Review
The following changes MUST be flagged for explicit human reviewer sign-off and must not be merged on AI-only approval, even if CI is green:
- Authentication or session-handling code.
- Payment or billing-related code.
- Any code that reads, writes, or logs secrets, tokens, or credentials.
- Changes to `.github/workflows/`, branch protection, or CI/CD configuration.
- Changes to `.env.example` or any secrets-adjacent configuration.

## Prohibited Actions
- Never run `git push --force`, `git reset --hard`, or destructive git operations without explicit user confirmation in the current session.
- Never bypass hooks or checks (`--no-verify`, disabling lint/test steps) to force a commit or merge.
- Never commit `.env`, credentials, API keys, or other secret material. If a secret is detected in a diff, stop and flag it rather than committing.
- Never remove or weaken branch protection, required status checks, or the secret-scan CI step.
- Do not fabricate test results, coverage numbers, or CI status — report actual tool output only.

## AI-Assisted Commit Identification
Every commit that included AI-generated or AI-assisted code includes a trailer identifying the assistant, e.g.:

```
Co-Authored-By: Claude <noreply@anthropic.com>
```

This applies regardless of how much of the diff was AI-authored — partial assistance still gets the trailer.

## Traceability
When implementing a task from a Kiro spec, reference the requirement ID(s) in the commit message or PR description, and in the test(s) added for that change.
