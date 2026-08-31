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
beforeCapture → adapter → schema validation → transform → validation → afterCapture
```

Plugins execute in declaration order. Every transformed snapshot is validated and byte-limited again.

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

## Redaction plugins

A transform can redact snapshot values, but a public redaction implementation must preserve graph validity and cover all sensitive fields deliberately. Do not claim secure redaction from a few regular-expression replacements.

The current Playwright adapter does not advertise the `redaction` capability, and the project does not yet ship a production redaction plugin.
