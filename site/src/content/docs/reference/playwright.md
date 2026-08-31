---
title: Playwright adapter
description: Supported Playwright features, adapter settings, and low-level capture API.
---

```bash
npm install domstamp @domstamp/playwright playwright-core
```

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

It does not advertise closed roots, pixels, native accessibility trees, or redaction.

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

`capturePlaywrightSnapshot(page, options)` and `PlaywrightCaptureOptions` are exported for specialized integrations. This bypasses core capability checks, retries, plugin hooks, deadlines, and schema validation.

Use the low-level function only when another orchestration layer provides those guarantees.
