# `@domstamp/puppeteer`

Puppeteer adapter for the framework-neutral [`domstamp`](../domstamp) API.

```bash
npm install domstamp @domstamp/puppeteer puppeteer-core
```

```ts
import { createDomstamp } from 'domstamp';
import { puppeteerAdapter } from '@domstamp/puppeteer';

const domstamp = createDomstamp(puppeteerAdapter());
const snapshot = await domstamp.capture(page);
```

The first release captures DOM, open Shadow DOM, frames (including
cross-origin frames), layout, interaction state, and mutation consistency.
Accessibility-tree and masked-pixel capabilities are not advertised.
Structural redaction remains available through the core. In this preview, the
adapter consumes the shared walker through `@domstamp/playwright`; extracting
that walker to a driver-neutral package remains a documented 1.0 task.
