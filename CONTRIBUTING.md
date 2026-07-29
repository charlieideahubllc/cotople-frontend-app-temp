# Contributing — cotople-frontend-app

## Scope
This repo is the web client only (`contact-capture-frontend` in the MVP SRS). See `CLAUDE.md` and `Contact_Capture_Event_Management_MVP_SRS_v3.0.md` before starting work.

## Workflow
1. Every change starts from a Kiro-style spec in `.kiro/specs/<feature-name>/` (`requirements.md`, `design.md`, `tasks.md`), following `.kiro/specs/_template/`. See `.kiro/steering/project-standards.md`.
2. Branch from `main`: `feature/<short-description>`, `fix/<short-description>`, or `chore/<short-description>` — `.kiro/steering/git-workflow.md`.
3. Commit using conventional style (`type(scope): summary`). Any AI-assisted commit includes a co-author trailer identifying the assistant, regardless of how much of the diff was AI-authored.
4. Reference the MVP SRS requirement ID(s) (e.g. `FR-MVP-CON-001`) in the commit message or PR description, and in any test added for the change.
5. Open a PR against `main`. Link the relevant `.kiro/specs/<feature-name>/` and requirement IDs. CI (secret scan, lint, typecheck, test, build) must pass.
6. Auth/session, payment/billing, secrets-handling code, or CI/CD config changes require explicit human reviewer sign-off — AI-only approval is not sufficient even with green CI (`CLAUDE.md`).

## Local Setup
See `README.md`.

## Coding Standards
- TypeScript strict mode; no unexplained `any`.
- ESLint/Prettier clean before opening a PR (`npm run lint`).
- New routes/components ship with at least one test referencing the requirement ID it verifies.
- No new dependency without checking it against alternatives already in the project.
- Don't add UI, roles, or flows explicitly marked out of MVP scope in the SRS (see SRS §3.5 and `SRS_CHECKLIST.md` §22).

## Testing
```
npm run lint
npx tsc --noEmit
npm test
npm run build
```

## Secrets
Never commit `.env.local`, credentials, or API keys. Only public config belongs in `.env.example` (see `SECURITY.md`).
