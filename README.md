# Domstamp

Domstamp captures the browser state an automation agent could perceive at a specific moment. The core is framework-neutral: React, Vue, Angular, Svelte, server-rendered HTML, and vanilla DOM all produce the same snapshot model, while browser automation tools plug in through typed adapters.

[Documentation](https://zuub-don.github.io/domstamp/) · [Public API](docs/PUBLIC_API.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

```ts
import { createDomstamp } from 'domstamp';
import { playwrightAdapter } from '@domstamp/playwright';

const domstamp = createDomstamp(playwrightAdapter(), {
  defaults: {
    scope: { mode: 'focus', siblingCount: 2, includeReferences: true },
    limits: { maxNodesPerFrame: 25_000, timeoutMs: 15_000 }
  }
});

const snapshot = await domstamp.capture(page);
```

## Packages

| Package | Responsibility | Runtime dependencies |
|---|---|---|
| `domstamp` | Schema, typed configuration, orchestration, plugins, validation | none |
| `@domstamp/playwright` | Iterative DOM/Shadow DOM/frame walker for Playwright | `playwright-core` peer |
| `@domstamp/tq1` | Lossless dictionary and gzip encoding with decode limits | Node standard library |

The core never imports Playwright or an application framework. A Selenium, WebDriver BiDi, browser-extension, or remote-browser adapter can implement the same `DomstampAdapter<TTarget>` interface without changing user code above the adapter boundary.

## Configuration

Configuration is immutable, layered, and capability-checked before browser work starts:

```ts
const focused = domstamp.withDefaults({
  scope: {
    mode: 'focus',
    siblingCount: 1,
    includeReferences: true
  },
  features: {
    dom: { comments: false, shadowRoots: 'open' },
    layout: { geometry: true, computedStyles: ['display', 'visibility'] },
    frames: { crossOrigin: true, maxFrames: 64 },
    interaction: { pointer: true, selection: true }
  },
  consistency: { mode: 'verify', retries: 2, settleMs: 16 },
  limits: {
    maxNodesPerFrame: 50_000,
    maxDepth: 1_024,
    maxSnapshotBytes: 32 * 1024 * 1024,
    timeoutMs: 20_000
  }
});
```

Unsupported requests—such as pixels on an adapter without pixel capture—fail with `UNSUPPORTED_CAPABILITY`; they are never silently ignored.

See [PUBLIC_API.md](docs/PUBLIC_API.md) for configuration precedence, adapters, plugins, errors, and schema guarantees.

## TQ1

```ts
import { decodeTq1, encodeTq1 } from '@domstamp/tq1';

const bytes = encodeTq1(snapshot);
const restored = decodeTq1(bytes);
```

TQ1 rejects cycles and non-finite numbers while its decoder enforces compressed-size, expanded-size, depth, string-table, array, and object limits.

## Development and gym

```bash
npm install
npm run build
npm run typecheck
npm test
```

Build and inspect the searchable documentation site:

```bash
npm run docs:check
npm run docs:build
npm run docs:preview
```

The Astro Starlight knowledge base lives under `site/`. Its Pagefind index is generated during the static build, and `.github/workflows/docs.yml` deploys `site/dist` to GitHub Pages. `DOCS_BASE` can override the automatically inferred repository subpath.

Run the pinned three-browser, two-origin Docker laboratory:

```bash
docker compose up --build --abort-on-container-exit --exit-code-from runner
```

Run deterministic chaos independently:

```bash
CHAOS_SEED=3737844653 CHAOS_STEPS=100 npm run test:chaos
```

The gym emits Playwright traces, screenshots, exact chaos plans, replay commands, checkpoint hashes, and minimized failing histories under `artifacts/`. Its rigor model is documented in [GYM.md](docs/GYM.md) and [CHAOS.md](docs/CHAOS.md).

## Project status

Domstamp is an early `0.1.0` preview. The source, public contract, conformance gym, and searchable documentation are available for evaluation. The npm packages have not yet been published; schema compatibility may change during the `0.x` series. See [DESIGN_REVIEW.md](docs/DESIGN_REVIEW.md) for the remaining package-release and `1.0` work.

## Security and license

See [SECURITY.md](SECURITY.md) before processing snapshots from untrusted sources. Domstamp is available under the [MIT License](LICENSE).
