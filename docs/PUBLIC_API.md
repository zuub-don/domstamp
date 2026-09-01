# Public API contract

## Design goals

The `domstamp` package is an orchestration kernel, not a browser driver. Its target type is generic and inferred from the adapter:

```ts
interface DomstampAdapter<TTarget, TAdapterOptions = unknown> {
  readonly name: string;
  readonly version: string;
  readonly capabilities: ReadonlySet<AdapterCapability>;
  readonly defaults?: CaptureSettings<TAdapterOptions>;
  capture(target: TTarget, context: AdapterContext<TAdapterOptions>): Promise<DomSnapshot>;
}
```

This keeps framework and driver dependencies outside the core while preserving full TypeScript inference. A Playwright or Puppeteer adapter receives its driver's `Page`; a WebDriver adapter may receive a session; a remote adapter may receive an RPC client.

## Construction

```ts
const domstamp = createDomstamp(adapter, {
  defaults,
  evidenceProviders,
  plugins,
  now // optional monotonic clock injection for tests
});
```

`createDomstamp` clones and freezes known configuration structures. Duplicate or empty plugin names, invalid numeric limits, malformed scope options, and invalid image quality fail immediately with `INVALID_CONFIG`.

## Configuration precedence

From lowest to highest precedence:

1. safe library defaults;
2. capability-safe defaults declared by the adapter;
3. defaults passed to `createDomstamp`;
4. defaults added through `withDefaults`;
5. per-capture overrides.

Objects merge by feature. Arrays replace rather than concatenate. `false` disables an optional feature. `withDefaults` returns a new client and never changes its parent.

Persistent defaults use `CaptureSettings`; per-call options use `CaptureOverrides`, which adds `signal`. This prevents an `AbortSignal` from being accidentally stored as a reusable default.

## Scope modes

- `document`: exhaustive bounded walk from the configured root;
- `viewport`: rendered viewport intersections plus structural ancestors, with optional margin;
- `focus`: deeply focused content, ancestors, nearby semantic siblings, labels, and ARIA dependencies.

Every mode is bounded by `maxNodesPerFrame`, `maxDepth`, `maxFrames`, `maxSnapshotBytes`, and `timeoutMs`.

## Capabilities

Capabilities are explicit strings such as `dom`, `layout`, `frames`, `cross-origin-frames`, `interaction`, `pixels`, and `accessibility-tree`. Domstamp calculates the capabilities required by the resolved configuration and rejects unsupported combinations before invoking the adapter. `shadowRoots: "all-available"` additionally requires `closed-shadow-roots`; Playwright advertises it only when constructed with pre-navigation closed-root instrumentation.

An adapter must not advertise a capability it only partially implements. Optional output must be disabled or represented explicitly; silent omission is a contract violation.

## Consistency

`best-effort` performs one capture. `verify` retries snapshots containing an `unstable` document up to the configured limit with an abort-aware settle delay. Persistent instability returns the snapshot with an `UNSTABLE_CAPTURE` diagnostic. Detached and errored frames remain explicit records.

## Cancellation and timeout

The effective signal combines the caller's `AbortSignal` with the configured timeout. The core races adapter and plugin promises against that signal, so a non-cooperative adapter cannot prevent the caller from regaining control. Adapters should still honor the signal to stop background work promptly.

Caller cancellation reports `ABORTED`; expiration of `limits.timeoutMs` reports `TIMEOUT`. This distinction is stable and lets callers decide whether to retry.

## Plugins

Capture stages execute in this order:

```text
beforeCapture → adapter → validation → evidence providers → validation → structural redaction → transform → validation → afterCapture
```

Plugin failures use `PLUGIN_FAILED` with plugin and hook metadata. Error hooks cannot replace the original error. Every transformed snapshot is schema-validated and size-checked again.

## Errors

All expected library failures use `DomstampError` and a stable code:

- `ABORTED`
- `CAPTURE_FAILED`
- `EVIDENCE_PROVIDER_FAILED`
- `INVALID_CONFIG`
- `INVALID_SNAPSHOT`
- `PLUGIN_FAILED`
- `TIMEOUT`
- `UNSUPPORTED_CAPABILITY`
- `UNSUPPORTED_SCHEMA`

Consumers should branch on `code`, never parse error messages.

## Schema versioning

Snapshots carry both `format: "domstamp"` and `schemaVersion`. Schema 3 is current. `inspectSnapshotCompatibility` recognizes schemas 1, 2, and 3, while `migrateSnapshot` validates current data and explicitly upgrades schemas 1 and 2. Schema 3 adds bounded evidence provenance with completeness, privilege, sensitivity, provider, source, and frame linkage. Unknown versions fail with `UNSUPPORTED_SCHEMA`.

During `0.x`, a schema change requires a minor package release and the current reader supports at least the two immediately preceding schemas. A patch release does not intentionally break the TypeScript API or schema. Every schema accepted by the `1.0` reader remains readable throughout `1.x`; removal requires a major release and prior deprecation notice.

## Evidence providers

`DomstampEvidenceProvider<TTarget, TAdapterOptions>` collects provenance observations after stable adapter validation. Provider identity is supplied by the core, observations are validated and deadline-bound, and structural redaction runs before plugins receive them. Successful collections emit `EVIDENCE_COLLECTED`; provider failures emit `EVIDENCE_PROVIDER_FAILED`.

## Adapter conformance

`runAdapterConformance(adapter, options)` is a test-runner-independent baseline that checks adapter metadata, the DOM capability, schema validity, and repeatability for a quiescent target. Playwright and Puppeteer additionally run through real-browser gym cases.
