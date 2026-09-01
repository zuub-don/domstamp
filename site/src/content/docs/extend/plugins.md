---
title: Write a plugin
description: Observe, transform, and report on captures through the ordered plugin lifecycle.
---

Plugins add cross-cutting behavior without coupling it to a browser adapter.

```ts
interface DomstampPlugin<TTarget, TAdapterOptions = unknown> {
  readonly name: string;
  beforeCapture?(context: PluginContext<TTarget, TAdapterOptions>): void | Promise<void>;
  transform?(snapshot: DomSnapshot, context: PluginContext<TTarget, TAdapterOptions>): DomSnapshot | Promise<DomSnapshot>;
  afterCapture?(result: CaptureResult, context: PluginContext<TTarget, TAdapterOptions>): void | Promise<void>;
  onError?(error: unknown, context: PluginContext<TTarget, TAdapterOptions>): void | Promise<void>;
}
```

## Lifecycle

```text
beforeCapture → adapter → validation → evidence providers → validation → structural redaction → transform → validation → afterCapture
```

Plugins execute in declaration order. Every transformed snapshot is validated and byte-limited again.

Evidence providers are separate from plugins because they describe capture provenance rather than consumer transformation. They receive validated adapter output, run under the same deadline, and are redacted before plugin transforms can observe the snapshot.

```ts
import type { DomstampPlugin } from 'domstamp';

const auditPlugin: DomstampPlugin<unknown> = {
  name: 'audit-log',
  beforeCapture({ config }) {
    console.info('capture:start', config.scope.mode);
  },
  transform(snapshot) {
    return snapshot;
  },
  afterCapture(result) {
    console.info('capture:finish', result.durationMs);
  },
  onError(error) {
    console.error('capture:error', error);
  }
};
```

## Failure behavior

A failing normal hook throws `PLUGIN_FAILED` with the plugin name and hook in `error.details`. Cancellation and timeout errors pass through unchanged.

`onError` cannot replace the original capture failure. Its own error is swallowed after the hook is bounded by the effective capture signal.

## Redaction and plugins

The trusted core redaction pass runs before plugin transforms. This prevents an ordinary consumer plugin from observing raw adapter output when redaction mode is enabled. A transform can perform additional policy-specific minimization, but it must preserve graph validity and is validated again afterward.

The Playwright adapter advertises `redaction` for masked pixel capture. Structural redaction is adapter-independent and does not require that capability. See [Redact sensitive captures](/guides/redaction/) for the complete data and pixel policy.
