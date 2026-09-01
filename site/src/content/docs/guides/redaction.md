---
title: Redact sensitive captures
description: Apply structural redaction and mask pixel evidence before snapshots leave the trust boundary.
---

Redaction is opt-in because Domstamp cannot infer which page values your system considers sensitive.

```ts
const snapshot = await domstamp.capture(page, {
  features: {
    accessibility: { relationships: true, tree: true },
    pixels: { format: 'png', fullPage: false, scale: 'css' }
  },
  data: {
    mode: 'redact',
    text: [sessionToken, accountNumber],
    attributes: ['data-token', 'data-customer-id'],
    urls: true,
    titles: true,
    accessibility: true,
    pixelMasks: ['[data-private]', '.payment-details'],
    pixelMaskColor: '#000000',
    replacement: '[MASKED]'
  }
});
```

The core validates raw adapter output, applies structural redaction, validates the result again, and only then runs consumer transforms. Node IDs and resolved reference targets remain stable.

Pixel masks are applied by the driver during screenshot capture. If pixels and redaction are both enabled, an empty mask list is rejected as `INVALID_CONFIG`.

## Prove the policy

Use unique sentinel secrets in the gym or an isolated test page. Assert that serialized output contains no sentinel, then change a secret entirely inside a masked region and assert that the screenshot hash is unchanged. This catches both structural leaks and incomplete visual masks.

Redaction is a policy tool, not a guarantee that an unnamed secret cannot appear. Treat snapshots and screenshots as sensitive until this test covers every data surface your application renders.
