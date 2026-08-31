---
title: Author an adapter
description: Implement a framework- and driver-specific capture adapter without coupling the core.
---

An adapter translates a driver target into a schema-valid `DomSnapshot`. The target and adapter-specific settings are generic and inferred by `createDomstamp`.

## Contract

```ts
interface DomstampAdapter<TTarget, TAdapterOptions = unknown> {
  readonly name: string;
  readonly version: string;
  readonly capabilities: ReadonlySet<AdapterCapability>;
  readonly defaults?: CaptureSettings<TAdapterOptions>;
  capture(
    target: TTarget,
    context: AdapterContext<TAdapterOptions>
  ): Promise<DomSnapshot>;
}
```

## Minimal adapter

```ts
import type {
  DomSnapshot,
  DomstampAdapter
} from 'domstamp';

interface Session {
  captureDom(signal: AbortSignal): Promise<DomSnapshot>;
}

interface SessionOptions {
  transport: 'local' | 'remote';
}

export const sessionAdapter: DomstampAdapter<Session, SessionOptions> = {
  name: 'session-adapter',
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
  capture(session, context) {
    return session.captureDom(context.signal);
  }
};
```

Adapter defaults sit between library defaults and consumer defaults. Use them to disable features the adapter does not support, not to hide missing behavior after capture.

## Declare capabilities honestly

| Capability | Required when |
| --- | --- |
| `dom` | Always |
| `open-shadow-roots` | Shadow policy is `open` or `all-available` |
| `closed-shadow-roots` | Shadow policy is `all-available` |
| `layout` | Layout is enabled |
| `frames` | Frames are enabled |
| `cross-origin-frames` | Cross-origin frames are enabled |
| `interaction` | Interaction state is enabled |
| `accessibility-tree` | Accessibility tree is requested |
| `pixels` | Pixel capture is requested |
| `mutation-consistency` | Consistency mode is `verify` |
| `redaction` | Data mode is `redact` |

Do not advertise a capability with partial, silently omitted output. Introduce a narrower adapter option or a new capability if the distinction matters to consumers.

## Required behavior

- Honor `context.signal` before and during expensive work.
- Obey resolved node, depth, frame, and time limits.
- Represent truncation and frame failures explicitly.
- Return schema version 1 and valid closed references.
- Avoid mutating the inspected page beyond any documented observer or instrumentation.
- Keep traversal iterative for attacker-controlled depth.

The core validates frame and node identity, parent graphs, references, geometry, runtime state, configured output ceilings, and JSON serializability. Adapter bugs fail as `INVALID_SNAPSHOT`.

## Conformance

Run a new adapter through the shared [Conformance gym](/operations/gym/). Tests should use the public `createDomstamp(adapter)` path rather than bypassing core orchestration.
