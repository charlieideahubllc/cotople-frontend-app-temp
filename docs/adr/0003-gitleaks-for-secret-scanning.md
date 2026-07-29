# 3. Use gitleaks (OSS CLI) for CI secret scanning

Date: 2026-07-22

## Status

Accepted

## Context

We need to block commits/PRs that contain secrets (API keys, credentials,
tokens) before they land on `main`, per AC-SP0-008 and US-0007 AC3.

Two options were considered:

1. **gitleaks in CI + pre-commit** — an open-source secret scanner, run as
   a CI job against the diff or full history.
2. **GitHub secret scanning / push protection only** — the platform-native
   feature.

GitHub's native secret scanning and push protection are not available on
private repositories under the GitHub Free plan that this organization is
currently on (the same limitation that blocks branch protection — see the
Sprint 0 tasks log). Relying solely on it was not an option right now
regardless of preference.

We also considered the official `gitleaks-action` GitHub Action, but it
requires a paid license for organizational use on private repositories.
The underlying `gitleaks` CLI itself is MIT-licensed and free to run
however we like, including via its public Docker image.

## Decision

Run the `gitleaks` CLI directly via `docker run zricethezav/gitleaks:latest
detect` as a dedicated `secret-scan` job in `ci.yml`, scanning full git
history, failing the workflow on any finding.

## Consequences

- No license cost, and it works today despite the Free-plan restriction on
  GitHub's native features.
- If/when the org upgrades to GitHub Team/Enterprise (see the branch
  protection follow-up in the Sprint 0 tasks log), GitHub's native push
  protection can be layered on top as defense in depth — this ADR doesn't
  preclude that, it just doesn't depend on it.
- The Docker-based invocation was not tested in this environment (no local
  Docker available) and should be spot-checked against a real Actions run.
