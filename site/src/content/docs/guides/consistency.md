---
title: Handle unstable pages
description: Use mutation verification, retries, deadlines, and cancellation on dynamic pages.
---

Dynamic pages may mutate while automation is deciding what to do. Domstamp makes that condition observable instead of claiming false determinism.

## Best effort

```ts
consistency: { mode: 'best-effort' }
```

The core performs one capture. This is appropriate when speed matters and the caller already controls page quiescence.

## Verify and retry

```ts
consistency: {
  mode: 'verify',
  retries: 2,
  settleMs: 16
}
```

The Playwright adapter installs its own mutation observer in every frame. It reads the epoch at the beginning of traversal and again after capture yields back to the browser. A changed epoch marks that document `unstable`.

The core waits `settleMs` and retries snapshots containing an unstable document. If the final attempt remains unstable, the snapshot is returned with an `UNSTABLE_CAPTURE` diagnostic.

## Deadline and cancellation

```ts
const controller = new AbortController();

await domstamp.capture(page, {
  limits: { timeoutMs: 10_000 },
  signal: controller.signal
});
```

- Caller cancellation throws `ABORTED`.
- Expiration of `timeoutMs` throws `TIMEOUT`.
- The core races adapter and plugin promises against the effective signal, so a non-cooperative adapter cannot hold the caller indefinitely.

Adapters should still honor `context.signal` to stop browser work promptly after the caller has regained control.
