# @domstamp/playwright

The optional Playwright adapter for `domstamp`. It works with `Page` objects from Playwright Test or the Playwright library and does not couple the core package to Playwright.

```bash
npm install domstamp @domstamp/playwright playwright-core
```

```ts
import { createDomstamp } from 'domstamp';
import { playwrightAdapter } from '@domstamp/playwright';

const capture = createDomstamp(playwrightAdapter());
const snapshot = await capture.capture(page, {
  scope: { mode: 'focus' },
  limits: { maxNodesPerFrame: 25_000 }
});
```

The walker is iterative and bounded. It supports document, viewport, and focus scopes; open Shadow DOM; template contents; runtime form/focus/selection/scroll/pointer state; same- and cross-origin frames; geometry; selected or complete computed styles; per-frame ARIA perception trees; and hashed PNG/JPEG screenshot attachments.

```ts
const detailed = await capture.captureDetailed(page, {
  features: {
    dom: { comments: false, shadowRoots: 'open', templates: true },
    layout: { geometry: true, computedStyles: ['display', 'visibility'] },
    frames: { crossOrigin: true, maxFrames: 64 },
    accessibility: { relationships: true, tree: true },
    pixels: { format: 'png', fullPage: false, scale: 'css' }
  },
  consistency: { mode: 'verify', retries: 2, settleMs: 16 },
  signal
});
```

The adapter advertises `accessibility-tree`, `pixels`, and pixel `redaction`. Accessibility data comes from Playwright's cross-browser ARIA snapshot, not a native operating-system tree. Structural redaction is provided by the core; screenshot redaction requires explicit `data.pixelMasks`. Closed Shadow DOM remains unsupported and fails capability negotiation rather than producing silently incomplete output.

For lower-level integrations, `capturePlaywrightSnapshot(page, options)` is exported, but `createDomstamp(playwrightAdapter())` is the supported orchestration path with validation, deadlines, retries, and plugins.
