---
title: Chaos laboratory
description: Reproduce, minimize, and reason about seeded browser-state fault campaigns.
---

Chaos testing is deterministic. A campaign is generated from a seed, then replayed as an explicit operation list.

## Run a campaign

```bash
CHAOS_SEED=3737844653 CHAOS_STEPS=100 npm run test:chaos
```

The default laboratory combines browser-state faults such as:

- DOM insertion, removal, and reordering;
- form and focus changes;
- scroll and pointer movement;
- visibility and attribute changes;
- Shadow DOM changes;
- frame attachment and detachment;
- virtualized list transitions.

## Failure record

Every failing campaign records:

- seed and step count;
- exact generated plan;
- browser project;
- checkpoint hashes;
- replay command;
- Playwright trace and screenshot;
- minimized failing history when reduction succeeds.

This record converts “the browser was chaotic” into a reproducible test case.

## Minimization

The reducer removes ranges of operations and replays the candidate plan. It keeps a smaller plan only when the same invariant still fails.

Important invariants include:

- same plan and initial state produce the same semantic checkpoints;
- all frame parents and owner paths resolve;
- all node parents and references remain closed;
- capture does not mutate the inspected page;
- configured budgets and explicit truncation agree;
- TQ1 round trips preserve the snapshot exactly.

## Operational use

Keep the exact seed in regression tests after fixing a defect. Add a smaller hand-authored conformance case when the minimized history reveals a stable browser primitive worth testing directly.
