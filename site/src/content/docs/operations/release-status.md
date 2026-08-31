---
title: Release status
description: Honest readiness assessment, current verification, and remaining public-release decisions.
---

Domstamp is available as a public source preview with a publishable package boundary. The npm packages remain unreleased while the remaining release-operational decisions are resolved. It is not yet a stable 1.0 contract.

## Verified now

- Framework-neutral, zero-runtime-dependency core.
- Generic target and adapter-setting inference.
- Immutable layered configuration and capability negotiation.
- Versioned snapshot schema and defensive graph validation.
- Optional Playwright and Node-only TQ1 packages.
- Strict TypeScript with exact optional properties.
- Package lint and ESM/bundler type-resolution audits.
- Package tarball dry-runs.
- 84-test Chromium, Firefox, and WebKit Docker matrix.
- GitHub Actions workflows for package checks, browsers, and documentation deployment.
- Canonical repository, documentation, issue, author, and private vulnerability-reporting metadata.

## Before first publication

1. Reserve `domstamp` and the `@domstamp` npm organization.
2. Make CI jobs required and configure protected provenance-enabled publishing.
3. State the `0.x` schema compatibility policy.
4. Complete a privacy review before making broad safe-capture claims.

## Before 1.0

- Implement and verify production redaction.
- Add million-node, long-session, memory, and latency gates with published hardware.
- Add historical schema fixtures and migration tests.
- Implement a second driver adapter to prove the abstraction beyond Playwright.
- Decide the browser/edge future of TQ1.
- Define pseudo-element, canvas/WebGL, closed-root, BFCache, and detached OOPIF behavior.

## Explicit non-claims

- “Lossless” covers represented fields and accessible boundaries, not arbitrary browser or heap state.
- Cross-framework is demonstrated; cross-driver is architecturally enabled but only Playwright is implemented today.
- Package names appearing available is not proof of ownership.
- Schema version 1 is versioned but not frozen for permanent storage.
