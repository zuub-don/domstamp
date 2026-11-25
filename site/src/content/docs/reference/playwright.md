---
title: Playwright adapter
description: Supported Playwright features, adapter settings, and low-level capture API.
---

```bash
npm install domstamp @domstamp/playwright playwright-core
```

:::caution[Not yet published]
These packages are not on the npm registry yet; the command above will 404 until the first release ships. Check the [repository README](https://github.com/zuub-don/domstamp#release-path) for current status.
:::

## Recommended API

```ts
import { createDomstamp } from 'domstamp';
import { playwrightAdapter } from '@domstamp/playwright';

const domstamp = createDomstamp(playwrightAdapter());
const snapshot = await domstamp.capture(page);
```

The adapter accepts a Playwright `Page`. Its walker is iterative and bounded.

## Advertised capabilities

- `dom`
- `open-shadow-roots`
- `layout`
- `frames`
- `cross-origin-frames`
- `interaction`
- `mutation-consistency`
- `accessibility-tree`
- `pixels`
- `redaction`

It advertises `closed-shadow-roots` only when constructed with a token from `installClosedShadowInstrumentation`. Its accessibility source is Playwright's cross-browser ARIA snapshot, not a native operating-system accessibility tree. `redaction` covers pixel masks; trusted structural redaction is applied in the core for every adapter.

## Instrumented closed roots

Install the preload before creating or navigating pages:

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

The preload retains author-created closed roots in a private weak registry. The iterative walker can then traverse nested and dynamically created roots in main and cross-origin frames. Every participating frame receives Schema 3 evidence provenance with availability and captured-root counts.

This is deliberately labeled `instrumented`, not `complete`. It cannot recover roots created before the preload, browser-owned user-agent roots, or roots hidden after a hostile page replaces the installed hook. `dispose()` removes the preload from future documents; already loaded documents remain instrumented.

## Accessibility and pixels

```ts
const snapshot = await domstamp.capture(page, {
  features: {
    accessibility: { relationships: true, tree: true },
    pixels: { format: 'png', fullPage: false, scale: 'css' }
  }
});
```

Accessibility trees carry roles, accessible names, values, states, and a closed parent graph per frame. Screenshot attachments include media type, dimensions, byte length, SHA-256, and base64 bytes.

Pixel evidence is environment-specific. Do not use its hash as a portable semantic oracle across browser versions, operating systems, fonts, or GPU stacks.

## Adapter settings

```ts
const domstamp = createDomstamp(playwrightAdapter(), {
  defaults: {
    adapter: {
      computedStyleProperties: [
        'display',
        'visibility',
        'pointer-events'
      ]
    }
  }
});
```

This replaces the adapter’s minimal property list unless the capture supplies an explicit `computedStyles` array or requests `all`.

## Low-level walker

`capturePlaywrightSnapshot(page, options)` and `PlaywrightCaptureOptions` are exported for specialized integrations. This bypasses core capability checks, evidence-provider orchestration, retries, plugin hooks, deadlines, and schema validation.

Use the low-level function only when another orchestration layer provides those guarantees.
