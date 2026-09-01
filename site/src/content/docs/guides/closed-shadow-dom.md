---
title: Capture closed Shadow DOM
description: Opt into pre-navigation instrumentation and interpret its Schema 3 provenance honestly.
---

Closed roots deliberately return `null` through `element.shadowRoot`. Domstamp can capture author-created closed roots only when a Playwright preload observes their creation.

## Install before navigation

```ts
import { chromium } from 'playwright';
import { createDomstamp } from 'domstamp';
import {
  installClosedShadowInstrumentation,
  playwrightAdapter
} from '@domstamp/playwright';

const browser = await chromium.launch();
const context = await browser.newContext();
const closedShadowRoots = await installClosedShadowInstrumentation(context);
const page = await context.newPage();

const domstamp = createDomstamp(playwrightAdapter({ closedShadowRoots }));

await page.goto('https://example.com');
const snapshot = await domstamp.capture(page, {
  features: { dom: { shadowRoots: 'all-available' } }
});
```

Install the preload before creating or navigating pages. Installing it after a document has created closed roots cannot recover those earlier references.

## Read the provenance

Schema 3 adds one `closed-shadow-dom` evidence record per captured frame:

```ts
const coverage = snapshot.evidence.filter(
  (entry) => entry.kind === 'closed-shadow-dom'
);

for (const entry of coverage) {
  console.log(entry.frameId, entry.completeness, entry.details.capturedRoots);
}
```

Expected fields:

- `source`: `preload-instrumentation`.
- `completeness`: `instrumented`, or `unavailable` when a frame could not expose the preload.
- `privilege`: `instrumented`.
- `sensitivity`: `sensitive`.
- `details.capturedRoots`: closed roots represented in that frame document.
- `details.instrumentationAvailable`: whether the registry accessor existed during capture.

`instrumented` means every root retained by the preload was eligible for capture. It does not mean the browser exposed every possible closed or user-agent root.

## Traversal and limits

Instrumented roots use ordinary bounded traversal. Nested and dynamically created roots participate in `maxNodesPerFrame`, `maxDepth`, focus scope, mutation consistency, structural redaction, validation, and TQ1 round trips. The `s` path segment crosses both open and instrumented closed-root boundaries.

Cross-origin frames receive the same context preload. Each frame keeps its own evidence record, so a missing instrument cannot be mistaken for an empty frame.

## Dispose deliberately

```ts
await closedShadowRoots.dispose();
```

Disposal removes the preload from future documents. Documents that already executed it remain instrumented until they are discarded or navigated.

## Non-claims

The instrumented path does not promise access to:

- roots created before installation;
- browser-owned user-agent shadow trees;
- a page that replaces or defeats the hook;
- browser chrome, extension UI, or JavaScript heap state.

Use an isolated browser context. Treat closed-root content as sensitive and exercise the same sentinel-redaction tests used for light DOM.
