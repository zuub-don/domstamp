# domstamp

Framework-neutral browser-state snapshot orchestration for automation and AI agents.

```bash
npm install domstamp
```

Domstamp does not know about React, Vue, Angular, Svelte, or any browser driver. It coordinates a typed adapter, validates its output, applies plugins, enforces limits, and returns a versioned snapshot.

## Capture

```ts
import { createDomstamp } from 'domstamp';
import { playwrightAdapter } from '@domstamp/playwright';

const domstamp = createDomstamp(playwrightAdapter(), {
  defaults: { scope: { mode: 'focus' } }
});

const snapshot = await domstamp.capture(page);
```

Use `captureDetailed` when diagnostics, adapter identity, and duration matter. Use `withDefaults` to derive a new immutable client without changing the original.

```ts
const focused = domstamp.withDefaults({
  scope: { mode: 'focus', siblingCount: 2, includeReferences: true },
  features: {
    dom: { comments: false },
    layout: { computedStyles: ['display', 'visibility'] }
  },
  limits: { maxNodesPerFrame: 25_000, timeoutMs: 15_000 }
});

const { snapshot, diagnostics } = await focused.captureDetailed(page, { signal });
```

Unsupported feature combinations fail before the adapter is called. Caller cancellation uses `ABORTED`; deadline expiry uses `TIMEOUT`.

## Write an adapter

The target and adapter-specific options are generic and inferred:

```ts
import type { DomSnapshot, DomstampAdapter } from 'domstamp';

interface Session { snapshot(): Promise<unknown> }
interface DriverOptions { transport: 'local' | 'remote' }

const adapter: DomstampAdapter<Session, DriverOptions> = {
  name: 'my-driver',
  version: '1.0.0',
  capabilities: new Set(['dom']),
  defaults: {
    features: {
      dom: { shadowRoots: 'none' },
      layout: false,
      frames: false,
      interaction: false,
      accessibility: false,
      pixels: false
    },
    consistency: { mode: 'best-effort' }
  },
  async capture(session, context) {
    // Honor context.signal and return schemaVersion 1.
    return await session.snapshot() as DomSnapshot;
  }
};
```

Adapter defaults should describe the safest useful behavior supported by its declared capabilities. Explicit consumer requests are still capability-checked.

## Boundaries

The core has no runtime dependencies. “Lossless” means lossless for fields and browser boundaries represented by the schema; it does not imply access to closed shadow roots, GPU state, browser chrome, or JavaScript heap state. Snapshot data may contain credentials, personal data, text, and form values—apply redaction before exporting it outside the browser’s trust boundary.
