# 1. Record architecture decisions

Date: 2026-07-22

## Status

Accepted

## Context

We need to record the architectural decisions made on this project so that
future contributors (human or AI) understand not just *what* was decided but
*why*, without having to reconstruct the reasoning from chat history or
tribal knowledge.

## Decision

We will use Architecture Decision Records, as described by Michael Nygard in
[Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

Each ADR is a numbered markdown file in `docs/adr/`, named
`NNNN-short-title.md`, containing:

- **Status** — Proposed, Accepted, Deprecated, or Superseded (by ADR-NNNN)
- **Context** — the situation and forces at play
- **Decision** — what we decided
- **Consequences** — what becomes easier or harder as a result

ADRs are immutable once accepted: if a decision changes, a new ADR
supersedes the old one rather than editing it in place.

## Consequences

Every non-trivial technical decision in this repository gets a short,
durable record. New contributors (and Claude Code) can read `docs/adr/` to
understand why the codebase looks the way it does, instead of re-litigating
settled decisions.
