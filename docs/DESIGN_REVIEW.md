# Public-readiness design review

Review date: 2026-08-31

## Executive assessment

The original repository contained a strong conformance gym but no publishable library boundary. The architecture now has a framework-neutral core, Playwright and Puppeteer adapters, an optional TQ1 codec, a versioned snapshot schema with explicit migration, structural redaction, capability negotiation, immutable layered configuration, cancellation, consistency retries, plugins, and public-package builds.

The design is suitable for a public source preview. The npm packages should wait until the P0 package-release items below are resolved, and it is not yet appropriate to promise a stable `1.0` schema.

## Quality scorecard

| Area | Status | Assessment |
|---|---|---|
| Framework independence | strong | Core has zero runtime dependencies and a generic adapter target |
| TypeScript API | strong | strict mode, exact optional properties, readonly public data, discriminated configuration |
| Configuration | strong | layered, immutable, per-feature, per-capture, capability checked |
| Failure semantics | strong | stable error codes, abort/timeout, explicit truncation and frame failures |
| Snapshot integrity | strong | schema, frame, node, parent, reference, active-node, and byte validation |
| Playwright implementation | good | iterative bounded walk, focus/viewport/document scopes, Shadow DOM and frame graph |
| Encoding security | good | gzip expansion limit, structural limits, cycle/non-finite rejection, safe prototype keys |
| Cross-driver ecosystem | good | Playwright and a real Puppeteer session exercise the same contract; the shared walker should become driver-neutral before 1.0 |
| Accessibility/pixels | good | Playwright emits ARIA perception trees and hashed screenshots; native OS trees remain outside the current promise |
| Schema evolution | good | schema 1 migrates explicitly to schema 2 with a historical fixture; the compatibility duration remains undecided |
| Release operations | partial | Canonical metadata and CI gates are defined; npm ownership, required checks, protected publishing, and support policy remain external |

## P0 — resolve before publishing

1. Reserve the unscoped `domstamp` package and the `@domstamp` npm organization. Availability checks are not ownership.
2. Make both CI jobs required after their first successful run, and configure provenance-enabled publish from a protected environment.
3. Choose and document the initial schema compatibility promise. A `0.x` preview may permit breaking schema changes; `1.0` must provide migrations or a declared compatibility window.
4. Run a secrets/privacy review before claiming safe lossless capture. Snapshots can include tokens, personal data, form values, and page text.

## P1 — required for a high-confidence 1.0

1. Publish repeatable peak-memory and capture-latency results for the configurable million-node profile on named hardware. The maximum-width scenario has completed locally, but that single result is not a portable benchmark.
2. Extract the shared DOM walker into a driver-neutral internal package so Puppeteer does not depend on the Playwright package boundary.
3. Decide whether TQ1 remains Node-only or gains a browser/edge compression transport.
4. Define and test the remaining BFCache, service-worker, WebSocket/SSE, IME, touch/pen, drag/drop, video, and WebGL cases.
5. Decide whether 1.0 promises a native OS accessibility source or the current cross-browser ARIA perception layer.

## P2 — ecosystem polish

1. Generated API symbol reference and standalone runnable examples.
2. Changesets or an equivalent release/version workflow.
3. Bundle-size and type-surface regression checks.
4. ESM/CJS support decision based on target-user evidence; the current packages are ESM-only.
5. Adapter authoring kit and third-party conformance badge.

## Decisions made during this review

- The package named `domstamp` is the zero-dependency core, not the Playwright implementation.
- Driver integrations are optional adapters and own their framework types.
- TQ1 is optional and cannot leak Node APIs into the core.
- Unsupported configuration fails before capture.
- Known configuration structures are cloned and frozen.
- Traversal is iterative and bounded.
- Timeouts are enforced even when adapters ignore cancellation.
- Plugin output is revalidated and byte-limited.
- Decoder input is treated as hostile.
- Package tarballs contain only compiled output, declarations, documentation, manifests, and complete licenses.
- Pull requests and `main` are gated by package audits and the three-browser Docker matrix.

## Explicit non-claims

- “Lossless” currently applies to the fields and accessible boundaries declared by the schema, not inaccessible closed roots, browser chrome, GPU state, or arbitrary JavaScript heap state.
- Cross-framework means application-framework independence. Cross-driver DOM capture is demonstrated with Playwright and Puppeteer; optional accessibility and pixel evidence remain Playwright-only.
- Schema 2 explicitly migrates schema 1, but the duration of the compatibility window is not frozen for 1.0.
