---
title: Core API
description: Public functions and types exported by the zero-dependency domstamp package.
---

## `createDomstamp`

```ts
function createDomstamp<TTarget, TAdapterOptions = unknown>(
  adapter: DomstampAdapter<TTarget, TAdapterOptions>,
  options?: DomstampOptions<TTarget, TAdapterOptions>
): Domstamp<TTarget, TAdapterOptions>;
```

Creates an immutable client. Target and adapter-option types are inferred from the adapter.

Options:

- `defaults`: persistent `CaptureSettings`.
- `plugins`: ordered plugin list with unique, non-empty names.
- `now`: optional monotonic clock injection for deterministic tests.

## `Domstamp`

```ts
interface Domstamp<TTarget, TAdapterOptions = unknown> {
  readonly adapter: Readonly<{
    name: string;
    version: string;
    capabilities: ReadonlySet<AdapterCapability>;
  }>;

  capture(target: TTarget, overrides?: CaptureOverrides<TAdapterOptions>): Promise<DomSnapshot>;
  captureDetailed(target: TTarget, overrides?: CaptureOverrides<TAdapterOptions>): Promise<CaptureResult>;
  withDefaults(overrides: CaptureSettings<TAdapterOptions>): Domstamp<TTarget, TAdapterOptions>;
}
```

`withDefaults` returns a new client and leaves its parent unchanged.

## `defineConfig`

```ts
function defineConfig<const TConfig extends CaptureSettings>(config: TConfig): TConfig;
```

Preserves literal types for reusable settings while performing compile-time structural checking.

```ts
const defaults = defineConfig({
  scope: { mode: 'focus', siblingCount: 2 },
  features: { layout: false }
});
```

## Validation

```ts
function validateConfig(config: CaptureConfig): void;

function validateSnapshot(
  snapshot: unknown,
  limits?: SnapshotValidationLimits
): asserts snapshot is DomSnapshot;
```

`validateSnapshot` checks schema identity, document and node metadata, parent graphs, reference closure, accessibility graphs, attachment metadata, geometry, runtime state, serialization fields, and optional document/node/depth ceilings. It throws `INVALID_SNAPSHOT` on failure.

## Compatibility and migration

```ts
function inspectSnapshotCompatibility(value: unknown): SnapshotCompatibility;
function migrateSnapshot(value: unknown): DomSnapshot;
```

The compatibility inspector recognizes supported schema versions without claiming that the remaining graph is valid. `migrateSnapshot` validates current schema-2 data and explicitly migrates schema 1 by adding empty accessibility and attachment arrays before validating the complete result. Unknown versions throw `UNSUPPORTED_SCHEMA`.

## Redaction

```ts
function redactSnapshot(
  snapshot: DomSnapshot,
  policy: Extract<DataPolicy, { mode: 'redact' }>
): RedactionResult;
```

Most consumers should configure `data.mode: 'redact'` on the client instead of calling this function directly. The direct export exists for trusted integration layers and returns the transformed snapshot plus a replacement count.

## Adapter conformance

```ts
function runAdapterConformance<TTarget, TAdapterOptions = unknown>(
  adapter: DomstampAdapter<TTarget, TAdapterOptions>,
  options: AdapterConformanceOptions<TTarget>
): Promise<AdapterConformanceReport>;
```

This runner-independent smoke kit validates adapter metadata, the baseline DOM capability, two complete snapshots, and deterministic output for a quiescent fixture. The Docker gym remains the comprehensive browser-semantic suite.

## Errors

```ts
class DomstampError extends Error {
  readonly code: DomstampErrorCode;
  readonly details: Readonly<Record<string, unknown>>;
}

function isDomstampError(value: unknown): value is DomstampError;
```

Branch on `code`; messages are written for people and are not a compatibility surface.
