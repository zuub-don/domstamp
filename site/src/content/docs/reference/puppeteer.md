---
title: Puppeteer adapter
description: Install and use the Puppeteer adapter, with its exact capability boundary.
---

```bash
npm install domstamp @domstamp/puppeteer puppeteer-core
```

:::caution[Not yet published]
These packages are not on the npm registry yet; the command above will 404 until the first release ships. Check the [repository README](https://github.com/zuub-don/domstamp#release-path) for current status.
:::

```ts
import { createDomstamp } from 'domstamp';
import { puppeteerAdapter } from '@domstamp/puppeteer';

const domstamp = createDomstamp(puppeteerAdapter());
const snapshot = await domstamp.capture(page);
```

The target is a Puppeteer `Page`. The adapter is validated in the Docker gym by a real Puppeteer process using the pinned Chromium binary and same-/cross-origin frame fixtures.

## Advertised capabilities

- `dom`
- `open-shadow-roots`
- `layout`
- `frames`
- `cross-origin-frames`
- `interaction`
- `mutation-consistency`

Accessibility-tree and pixel capture default to `false` and are not advertised. Requesting them fails before browser work begins. Structural redaction remains supported in the framework-neutral core; redacted screenshots require a pixel-capable adapter such as Playwright.

## Adapter settings

`computedStyleProperties?: readonly string[]` has the same meaning as the Playwright setting: it replaces the minimal computed-style property list unless the capture supplies an explicit list or selects `all`.
