# Public-readiness design review

Review date: 2026-08-31

## Executive assessment

The original repository contained a strong conformance gym but no publishable library boundary. The architecture now has a framework-neutral core, optional Playwright adapter, optional TQ1 codec, versioned snapshot schema, capability negotiation, immutable layered configuration, cancellation, consistency retries, plugins, and public-package builds.

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
| Cross-driver ecosystem | incomplete | only Playwright adapter exists today |
| Accessibility/pixels | incomplete | modeled and safely rejected by Playwright; native capture is not implemented |
| Schema evolution | incomplete | version exists; migrations and compatibility window are not defined |
| Release operations | partial | Canonical metadata and CI gates are defined; npm ownership, required checks, protected publishing, and support policy remain external |

## P0 — resolve before publishing

1. Reserve the unscoped `domstamp` package and the `@domstamp` npm organization. Availability checks are not ownership.
2. Make both CI jobs required after their first successful run, and configure provenance-enabled publish from a protected environment.
3. Choose and document the initial schema compatibility promise. A `0.x` preview may permit breaking schema changes; `1.0` must provide migrations or a declared compatibility window.
4. Run a secrets/privacy review before claiming safe lossless capture. Snapshots can include tokens, personal data, form values, and page text.

## P1 — required for a high-confidence 1.0

1. Implement redaction in a dedicated transform or adapter and test that references remain valid after redaction.
2. Add native accessibility-tree and pixel-layer capture, or keep both outside the first stable capability set.
3. Add million-node, long-session, memory-ceiling, and capture-latency gates with published benchmark hardware.
4. Add schema fixtures from old versions and forward/backward compatibility tests.
5. Add WebDriver BiDi or Selenium as the second adapter to prove the abstraction is real rather than Playwright-shaped.
6. Decide whether TQ1 remains Node-only or gains a browser/edge compression transport.
7. Define behavior for closed Shadow DOM, pseudo-elements, canvas/WebGL, BFCache, detached OOPIFs, service workers, and hostile prototype modification.

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
- Cross-framework means application-framework independence today. Cross-driver support is architecturally enabled but not yet demonstrated beyond Playwright.
- The reference schema is versioned but not frozen for 1.0.
