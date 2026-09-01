---
title: Release status
description: Honest readiness assessment, current verification, and remaining public-release decisions.
---

Domstamp `0.3.0` is a finalized public source preview with a publishable package boundary and guarded release workflow. The npm packages remain unreleased until registry ownership and protected GitHub controls are configured. It is not yet a stable 1.0 contract.

## Verified now

- Framework-neutral, zero-runtime-dependency core.
- Generic target and adapter-setting inference.
- Immutable layered configuration and capability negotiation.
- Versioned snapshot schema and defensive graph validation.
- Explicit schema-1 and schema-2 migration to Schema 3 with historical fixtures.
- Validated evidence-provider orchestration with completeness, privilege, and sensitivity provenance.
- Opt-in Playwright closed-root instrumentation across nested, dynamic, and cross-origin frame cases.
- Trusted structural redaction plus mandatory masks for redacted pixel capture.
- Playwright ARIA perception trees and hashed PNG/JPEG attachments.
- Real Playwright and Puppeteer adapters on the shared contract.
- Configurable wide-DOM, repeated-session, frame-churn, hostile-hook, rendering-boundary, and deterministic-chaos gates.
- Optional Node-only TQ1 package.
- Strict TypeScript with exact optional properties.
- Package lint and ESM/bundler type-resolution audits.
- Package tarball dry-runs.
- Chromium, Firefox, and WebKit Docker matrix, plus Puppeteer on pinned Chromium.
- GitHub Actions workflows for package checks, browsers, documentation deployment, and protected provenance-enabled publication.
- A tag/version/changelog release contract, guarded publisher, and documented partial-publish recovery path.
- Canonical repository, documentation, issue, author, and private vulnerability-reporting metadata.

## Before first publication

1. Reserve `domstamp` and the `@domstamp` npm organization.
2. Protect `main`, require both CI jobs, and create the reviewer-protected `npm` environment.
3. Add the bootstrap npm credential, then configure trusted publishing after the packages exist.
4. Complete the final human privacy review before making any broader safe-capture claim.

Follow the exact [release procedure](/operations/releasing/). The repository gates are complete; these remaining steps change external account state and cannot be inferred from source code.

## Remaining before 1.0

- Publish repeatable capture-latency and peak-memory results for the one-million-node profile on named hardware. The opt-in maximum-width scenario already completes locally; that result is not presented as a portable benchmark.
- Extract the shared DOM walker from the Playwright package boundary so Puppeteer does not pull a Playwright-package dependency.
- Decide the browser/edge future of TQ1.
- Add a native accessibility source if the 1.0 promise requires OS-level trees; the current source is ARIA semantics.
- Expand BFCache, service-worker, WebSocket/SSE, IME, touch/pen, drag/drop, video, and WebGL-specific fixtures.

## Explicit non-claims

- “Lossless” covers represented fields and accessible boundaries, not arbitrary browser or heap state.
- Cross-driver DOM capture is demonstrated with Playwright and Puppeteer. Optional accessibility and pixel evidence remain Playwright-only.
- Package names appearing available is not proof of ownership.
- During `0.x`, the current reader retains at least the two immediately preceding schemas. Schemas accepted by the `1.0` reader remain readable throughout `1.x`.
