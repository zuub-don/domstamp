# Deterministic chaos system

Random browser tests are usually noise. Domstamp Gym uses seeded chaos: the scheduler generates an exact action history, the runner captures invariant checkpoints, and then a clean page replays the same history. A failure is useful only when its seed and actions reproduce it.

## Fault surfaces

The `chaos-laboratory` scenario combines interacting browser subsystems rather than testing each in isolation:

- focus transfers between light DOM, scrolled content, and nested Shadow DOM;
- runtime input values and selections diverge from markup;
- branches hide, reorder, clone, and replace;
- nested scrolling changes geometry without changing topology;
- iframes detach, reattach, and navigate;
- slotted content changes assignment and text;
- live regions churn under a bounded logical history;
- network requests succeed, delay, return 503, disconnect, or truncate mid-body.

The scheduler uses a deterministic xorshift32 stream. Given the same seed and step count, it produces byte-identical `chaos-plan.json` histories.

## Checkpoints and invariants

Every fourth action captures a snapshot, rotating through `document`, `focus`, and `viewport` modes. Each checkpoint asserts:

- stable mutation epochs;
- unique node and frame IDs;
- closed parent and reference relationships;
- resolvable frame parents;
- bounded traversal;
- deterministic semantic hashes during a clean replay.

Pointer state and raw epoch numbers are excluded from replay hashes because browsers may synthesize pointer movement and batch MutationObserver deliveries differently. Their semantic status remains validated independently.

## Reproduction

```bash
CHAOS_SEED=3737844653 CHAOS_STEPS=43 npm run test:chaos -- --project=chromium
```

Playwright attaches the exact plan, checkpoint hashes, and replay command to the test report. On failure, delta-debugging removes action chunks while the invariant still fails and emits `chaos-minimized.json`.

## Why the shrinker matters

A 500-step history might fail only after a frame detach, slot reassignment, and input focus transfer interact. The shrinker repeatedly removes partitions and replays the remainder. The resulting minimal history becomes a regression fixture instead of a permanently expensive mystery seed.
