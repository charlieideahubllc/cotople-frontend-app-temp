# Security — cotople-frontend-app

## Reporting
Report suspected vulnerabilities or exposed secrets privately to the repository owner. Do not open a public issue for an active exposure.

## Secret Handling
- This repo is a browser client. Only `NEXT_PUBLIC_*` variables belong here, and only values safe to ship to every visitor's browser: Supabase URL, Supabase **anonymous** key, backend base URL, build/environment label. See `.env.example`.
- The following must **never** appear in this repo, in a commit, in a client bundle, or in application logs:
  - Supabase service-role key
  - OpenAI API key
  - HighLevel client secret, HighLevel access/refresh tokens
  - Any database or pooler connection string
  - Passwords or password hashes
- `.env.local` is gitignored and must never be committed.
- If a secret is detected in a diff or in CI (gitleaks), stop and rotate it — do not just remove it from the file and re-commit.

## Auth
- Identity, sessions, and password handling are owned by Supabase Auth. This repo does not implement custom JWT issuance, refresh-token storage, or password hashing.
- The frontend's role-based UI (Admin/Staff) is a convenience layer only. Authorization is enforced server-side; this client never treats a hidden button as an access control.

## Third-Party Data Flow
- Business-card images upload directly from the browser to private Supabase Storage using a signed URL obtained from the backend. Image bytes are never proxied through this app's own server code.
- This client never calls OpenAI or HighLevel APIs directly, and never receives or stores GHL OAuth tokens.

## CI Enforcement
- Every PR runs a gitleaks secret scan (`.github/workflows/ci.yml`) in addition to lint/typecheck/test/build. A failing secret scan blocks merge.

## Mandatory Human Review
Per `CLAUDE.md`, changes to authentication/session handling, payment/billing code, code that reads/writes/logs secrets or tokens, `.github/workflows/`, branch protection/CI config, or `.env.example`/secrets-adjacent config require explicit human sign-off and cannot merge on AI-only approval.
