---
title: Release status
description: Honest readiness assessment, current verification, and remaining public-release decisions.
---

Domstamp `0.2.0` is available as a public source preview with a publishable package boundary. The npm packages remain unreleased while the remaining release-operational decisions are resolved. It is not yet a stable 1.0 contract.

## Verified now

- Framework-neutral, zero-runtime-dependency core.
- Generic target and adapter-setting inference.
- Immutable layered configuration and capability negotiation.
- Versioned snapshot schema and defensive graph validation.
- Explicit schema-1 to schema-2 migration with a historical fixture.
- Trusted structural redaction plus mandatory masks for redacted pixel capture.
- Playwright ARIA perception trees and hashed PNG/JPEG attachments.
- Real Playwright and Puppeteer adapters on the shared contract.
- Configurable wide-DOM, repeated-session, frame-churn, hostile-hook, rendering-boundary, and deterministic-chaos gates.
- Optional Node-only TQ1 package.
- Strict TypeScript with exact optional properties.
- Package lint and ESM/bundler type-resolution audits.
- Package tarball dry-runs.
- Chromium, Firefox, and WebKit Docker matrix, plus Puppeteer on pinned Chromium.
- GitHub Actions workflows for package checks, browsers, and documentation deployment.
- Canonical repository, documentation, issue, author, and private vulnerability-reporting metadata.

## Before first publication

1. Reserve `domstamp` and the `@domstamp` npm organization.
2. Make CI jobs required and configure protected provenance-enabled publishing.
3. State the complete `0.x` and post-1.0 schema compatibility policy.
4. Complete a privacy review before making broad safe-capture claims.

## Remaining before 1.0

- Publish repeatable capture-latency and peak-memory results for the one-million-node profile on named hardware. The opt-in maximum-width scenario already completes locally; that result is not presented as a portable benchmark.
- Extract the shared DOM walker from the Playwright package boundary so Puppeteer does not pull a Playwright-package dependency.
- Add a protected, provenance-enabled npm release workflow after package ownership is established.
- Decide and publish the supported schema migration window and deprecation process.
- Decide the browser/edge future of TQ1.
- Add a native accessibility source if the 1.0 promise requires OS-level trees; the current source is ARIA semantics.
- Expand BFCache, service-worker, WebSocket/SSE, IME, touch/pen, drag/drop, video, and WebGL-specific fixtures.

## Explicit non-claims

- “Lossless” covers represented fields and accessible boundaries, not arbitrary browser or heap state.
- Cross-driver DOM capture is demonstrated with Playwright and Puppeteer. Optional accessibility and pixel evidence remain Playwright-only.
- Package names appearing available is not proof of ownership.
- Schema 1 migrates to schema 2, but the duration of that compatibility promise is not frozen until 1.0.
