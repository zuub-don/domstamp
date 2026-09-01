# domstamp

Framework-neutral browser-state snapshot orchestration for automation and AI agents.

```bash
npm install domstamp
```

Domstamp does not know about React, Vue, Angular, Svelte, or any browser driver. It coordinates a typed adapter, validates its output, applies trusted structural redaction and plugins, enforces limits, and returns a versioned snapshot.

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
    // Honor context.signal and return a schemaVersion 3 snapshot.
    return await session.snapshot() as DomSnapshot;
  }
};
```

Adapter defaults should describe the safest useful behavior supported by its declared capabilities. Explicit consumer requests are still capability-checked.

Use the driver-neutral smoke kit before running the complete browser gym:

```ts
import { runAdapterConformance } from 'domstamp';

await runAdapterConformance(adapter, {
  createTarget: () => openFixtureSession(),
  disposeTarget: (session) => session.close()
});
```

## Evidence providers

Driver-neutral evidence collectors run after adapter validation and before trusted redaction:

```ts
const domstamp = createDomstamp(adapter, {
  evidenceProviders: [{
    name: 'session-envelope',
    version: '1.0.0',
    collect: ({ snapshot }) => [{
      id: 'session:main',
      kind: 'session-state',
      frameId: snapshot.documents[0]?.frameId ?? null,
      source: 'session-api',
      completeness: 'complete',
      privilege: 'standard',
      sensitivity: 'sensitive'
    }]
  }]
});
```

The core supplies provider identity and validates every observation. Providers run before structural redaction and therefore belong in the trusted capture boundary. Provider failures use `EVIDENCE_PROVIDER_FAILED`; successful collections add `EVIDENCE_COLLECTED` diagnostics.

## Schema compatibility and redaction

`inspectSnapshotCompatibility(value)` identifies schema 1, 2, and 3 data. `migrateSnapshot(value)` validates the complete graph and explicitly upgrades schema 1 or 2 to schema 3 without fabricating evidence.

Structural redaction runs after raw adapter validation and before consumer plugin transforms. It preserves IDs and resolved graph targets while covering configured text, attributes, runtime input values, metadata, styles, references, and accessibility strings. Redacted screenshots additionally require masks from a pixel-capable adapter.

## Boundaries

The core has no runtime dependencies. “Lossless” means lossless for fields and browser boundaries represented by the schema; it does not imply native access to closed shadow roots, GPU state, browser chrome, or JavaScript heap state. Optional providers and instrumentation must label their provenance and completeness. Snapshot data may contain credentials, personal data, text, and form values—configure and test an explicit redaction policy before exporting it outside the browser’s trust boundary.
