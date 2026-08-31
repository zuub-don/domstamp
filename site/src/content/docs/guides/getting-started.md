---
title: Install and capture
description: Install Domstamp, capture a Playwright page, and inspect the result.
---

## Install

Domstamp is ESM-only and requires Node.js 20 or later.

```bash
npm install domstamp @domstamp/playwright playwright-core
```

If your project already uses `@playwright/test` or `playwright`, its compatible `playwright-core` installation satisfies the peer dependency.

## Capture a page

```ts
import { chromium } from 'playwright';
import { createDomstamp } from 'domstamp';
import { playwrightAdapter } from '@domstamp/playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('https://example.com');

const domstamp = createDomstamp(playwrightAdapter());
const snapshot = await domstamp.capture(page);

console.log(snapshot.schemaVersion); // 1
console.log(snapshot.documents.length);

await browser.close();
```

The target type is inferred from the adapter. Passing something other than a Playwright `Page` is a TypeScript error.

## Choose bounded defaults

```ts
const domstamp = createDomstamp(playwrightAdapter(), {
  defaults: {
    scope: { mode: 'focus', siblingCount: 2, includeReferences: true },
    features: {
      layout: { geometry: true, computedStyles: ['display', 'visibility'] },
      frames: { crossOrigin: true, maxFrames: 32 }
    },
    limits: {
      maxNodesPerFrame: 25_000,
      maxDepth: 1_024,
      maxSnapshotBytes: 32 * 1024 * 1024,
      timeoutMs: 15_000
    }
  }
});
```

Configuration precedence is library defaults, adapter defaults, client defaults, `withDefaults`, then per-capture overrides. Known structures are cloned and frozen.

## Keep diagnostics

`capture()` returns only the snapshot. Use `captureDetailed()` when the calling system needs timing, adapter identity, or warnings.

```ts
const result = await domstamp.captureDetailed(page, { signal });

for (const diagnostic of result.diagnostics) {
  console.warn(diagnostic.code, diagnostic.message);
}
```

Persistent mutation instability returns `UNSTABLE_CAPTURE` as a warning. Expected failures throw `DomstampError` with a stable `code`.

## Compress for storage or transport

```bash
npm install @domstamp/tq1
```

```ts
import { encodeTq1, decodeTq1 } from '@domstamp/tq1';

const payload = encodeTq1(snapshot);
const restored = decodeTq1(payload);
```

TQ1 is Node-only and accepts JSON-compatible values. Configure decoder limits before accepting untrusted payloads.
