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

The adapter advertises `accessibility-tree`, `pixels`, and pixel `redaction`. Accessibility data comes from Playwright's cross-browser ARIA snapshot, not a native operating-system tree. Structural redaction is provided by the core; screenshot redaction requires explicit `data.pixelMasks`.

## Instrumented closed roots

Call the installer before creating or navigating pages, then pass its token to the adapter:

```ts
import {
  installClosedShadowInstrumentation,
  playwrightAdapter
} from '@domstamp/playwright';

const closedShadowRoots = await installClosedShadowInstrumentation(context);
const page = await context.newPage();
const capture = createDomstamp(playwrightAdapter({ closedShadowRoots }));

await page.goto(targetUrl);
const snapshot = await capture.capture(page, {
  features: { dom: { shadowRoots: 'all-available' } }
});
```

Only this configured adapter advertises `closed-shadow-roots`. The walker captures author-created roots observed by the preload, including nested, dynamic, and cross-origin-frame roots, and emits per-frame Schema 3 provenance. Coverage is labeled `instrumented`: roots created before installation, user-agent roots, or hostile pages that replace the hook are not claimed as complete.

For lower-level integrations, `capturePlaywrightSnapshot(page, options)` is exported, but `createDomstamp(playwrightAdapter())` is the supported orchestration path with validation, deadlines, retries, and plugins.
