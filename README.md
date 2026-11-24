# Domstamp

Domstamp captures the browser state an automation agent could perceive at a specific moment. The core is framework-neutral: React, Vue, Angular, Svelte, server-rendered HTML, and vanilla DOM all produce the same snapshot model, while browser automation tools plug in through typed adapters.

Current source release: **`0.3.0` preview**. The package boundary and guarded release workflow are ready, but the npm packages have not been published.

[Documentation](https://zuub-don.github.io/domstamp/) · [**Architecture walkthrough**](https://zuub-don.github.io/domstamp/architecture/) · [Public API](docs/PUBLIC_API.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

An interactive, chaptered diagram of the full capture pipeline — driver → adapter → walker → frames → shadow DOM → consistency → redaction → evidence → codec — with the chaos gym's fault injection mapped against every stage: **[zuub-don.github.io/domstamp/architecture](https://zuub-don.github.io/domstamp/architecture/)**

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
| `domstamp` | Schema, typed configuration, orchestration, evidence providers, plugins, validation | none |
| `@domstamp/playwright` | DOM/frame walker, ARIA perception trees, and masked pixel evidence | `playwright-core` peer |
| `@domstamp/puppeteer` | Puppeteer DOM, frame, layout, and interaction adapter | `puppeteer-core` peer; shared preview walker |
| `@domstamp/tq1` | Lossless dictionary and gzip encoding with decode limits | Node standard library |

The core never imports a browser driver or application framework. Playwright and Puppeteer now exercise the same snapshot contract. A Selenium, WebDriver BiDi, browser-extension, or remote-browser adapter can implement `DomstampAdapter<TTarget>` without changing user code above the adapter boundary.

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

## Accessibility, pixels, and redaction

Playwright can add a per-frame ARIA perception graph and hashed screenshot evidence:

```ts
const snapshot = await domstamp.capture(page, {
  features: {
    accessibility: { relationships: true, tree: true },
    pixels: { format: 'png', fullPage: false, scale: 'css' }
  },
  data: {
    mode: 'redact',
    text: [sessionToken],
    attributes: ['data-token'],
    pixelMasks: ['[data-private]']
  }
});
```

Structural redaction runs in the core before consumer plugins. Redacted pixels require masks because changing DOM strings cannot alter already-rasterized screenshot content.

## Closed Shadow DOM and evidence provenance

Closed roots require explicit instrumentation before page scripts create them:

```ts
import {
  installClosedShadowInstrumentation,
  playwrightAdapter
} from '@domstamp/playwright';

const closedShadowRoots = await installClosedShadowInstrumentation(context);
const page = await context.newPage();
const domstamp = createDomstamp(playwrightAdapter({ closedShadowRoots }));

await page.goto(targetUrl);
const snapshot = await domstamp.capture(page, {
  features: { dom: { shadowRoots: 'all-available' } }
});
```

Schema 3 records per-frame evidence provenance with its source, provider version, completeness, privilege, sensitivity, and captured-root count. Instrumented coverage is never mislabeled as native or universally complete. Browser chrome and JavaScript heap capture remain outside the standard snapshot.

## Schema compatibility

Schema 3 is current. Historical schema-1 and schema-2 snapshots migrate explicitly and are validated as complete graphs:

```ts
import { inspectSnapshotCompatibility, migrateSnapshot } from 'domstamp';

const compatibility = inspectSnapshotCompatibility(stored);
const snapshot = migrateSnapshot(stored);
```

Unknown versions fail with `UNSUPPORTED_SCHEMA`; migrations add empty fields rather than inventing accessibility, pixel, or privileged evidence.

## Puppeteer

```ts
import { createDomstamp } from 'domstamp';
import { puppeteerAdapter } from '@domstamp/puppeteer';

const snapshot = await createDomstamp(puppeteerAdapter()).capture(page);
```

Puppeteer supports DOM, open Shadow DOM, same- and cross-origin frames, layout, interaction state, and mutation consistency. Optional accessibility, pixel, and instrumented closed-root layers remain Playwright-only in `0.3.0`.

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

## Release path

Schema 3, explicit schema-1/schema-2 migration, evidence provenance, instrumented closed roots, structural redaction, Playwright accessibility/pixels, the Puppeteer adapter, conformance gym, searchable documentation, and guarded release automation are ready for evaluation. See [RELEASING.md](docs/RELEASING.md) for the candidate gate and first-publication prerequisites, and [DESIGN_REVIEW.md](docs/DESIGN_REVIEW.md) for the remaining `1.0` work.

## Security and license

See [SECURITY.md](SECURITY.md) before processing snapshots from untrusted sources. Domstamp is available under the [MIT License](LICENSE).
