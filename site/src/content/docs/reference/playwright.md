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
- `accessibility-tree`
- `pixels`
- `redaction`

It does not advertise closed roots. Its accessibility source is Playwright's cross-browser ARIA snapshot, not a native operating-system accessibility tree. `redaction` covers pixel masks; trusted structural redaction is applied in the core for every adapter.

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

`capturePlaywrightSnapshot(page, options)` and `PlaywrightCaptureOptions` are exported for specialized integrations. This bypasses core capability checks, retries, plugin hooks, deadlines, and schema validation.

Use the low-level function only when another orchestration layer provides those guarantees.
