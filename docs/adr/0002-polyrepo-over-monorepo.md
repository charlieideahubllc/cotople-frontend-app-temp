# 2. Use a polyrepo (separate repos per app) instead of a monorepo

Date: 2026-07-22

## Status

Accepted

## Context

The Cotople product consists of three apps — a Next.js web frontend
(`cotople-frontend-app`), a React Native mobile app (`cotople-mobile-app`),
and a FastAPI backend (`cotople-backend-api`). We needed to decide whether
these would live in a single monorepo or in separate repositories.

Sprint 0 planning initially assumed a monorepo (shared `packages/`, one CI
pipeline, one PR flow), documented in the Sprint 0 design spec. Before that
work began, three separate GitHub repositories were provisioned under the
`Ideahub-Solutions-LLC` organization — one per app — establishing the
polyrepo layout as the actual starting point.

## Decision

We use a polyrepo: `cotople-frontend-app`, `cotople-mobile-app`, and
`cotople-backend-api` are independent repositories, each with its own
`.kiro/`, `CLAUDE.md`, CI/CD workflows, and ADR log.

## Consequences

- Each app deploys, versions, and is CI-tested independently — a broken
  mobile build never blocks a backend deploy.
- Repo-level access control can differ per team/app if needed.
- Shared TypeScript types between the frontend and mobile app are not
  automatically shared; they must be duplicated or published as a
  versioned package. This is accepted as a Sprint 0 trade-off and should be
  revisited (via a new ADR) if duplication becomes a real maintenance cost.
- Cross-app changes (e.g. an API contract change touching both frontend and
  backend) require coordinated PRs across repos instead of one atomic PR.
