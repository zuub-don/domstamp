# Domstamp Gym design

## Mission

The gym answers one question: **can a snapshot reconstruct the browser state that mattered to an automation agent at the instant of capture?**

It is framework-neutral at the snapshot boundary. Playwright provides repeatable control over Chromium, Firefox, WebKit, frames, input, network interception, traces, and browser contexts. Puppeteer now exercises the same DOM snapshot contract on Chromium. Selenium and WebDriver BiDi adapters can adopt the same scenario, oracle, and conformance protocol later.

## Rigor model

The suite borrows the useful properties of distributed-systems testing:

1. **Determinism.** Every generated fixture has a seed. Mutations advance only through an explicit logical clock. Locale, timezone, viewport, motion preference, and browser versions are pinned.
2. **Fault injection.** The finished gym will control network delay, dropped responses, frame churn, DOM mutation, navigation races, renderer pressure, and process restarts at named checkpoints.
3. **History.** Every run records the seed, scenario, action log, logical ticks, snapshot hashes, browser identity, and artifacts required to replay a failure.
4. **Invariants over examples.** Tests assert round-trip fidelity, stable ordering, referential integrity, scope closure, and deterministic hashes—not only golden files.
5. **Differential testing.** A production adapter is compared with the simple reference capture, browser-native accessibility/layout sources where available, and the other browser engines.
6. **Shrinking.** Generated failures must reduce to the smallest DOM, action sequence, and mutation schedule that still violates an invariant.

## What is stable truth?

Semantic and visual validation are intentionally separate.

| Layer | Validation | Stability |
|---|---|---|
| DOM topology and values | exact structural equality | cross-platform |
| Focus, selection, form state | exact semantic equality | cross-platform |
| Geometry and computed style | numeric/property invariants | engine-specific |
| Accessibility | role/name/state invariants | engine-specific |
| Pixels, canvas, WebGL | screenshots and perceptual comparison | environment-specific |
| Encoding | decode(encode(x)) = x, corruption rejection | byte-exact |

A pixel image is evidence, but it is not a portable semantic oracle. Font rasterization and GPU differences must not make an otherwise correct DOM snapshot fail.

## Current scenario surface

- Document topology: elements, text, comments, hidden/inert/offscreen content, and semantic controls
- Runtime form state: values that differ from attributes, checked/indeterminate state, focus, and selection
- Open and instrumented closed Shadow DOM: host boundaries, slots, styles, deep focus, nested roots, dynamic churn, and provenance
- Browsing contexts: same-origin, cross-origin, and nested foreign-origin frame chains with ownership links
- Deterministic mutation: explicit logical ticks and replayable state transitions
- Layout: transforms, fixed overlays, nested scrolling, overflow, and geometry
- Pointer state: current coordinates, pointer type, and buttons
- Scope algorithms: bounded `focus`, `viewport`, and exhaustive `document` walks
- Relationship closure: labels and ARIA ID references resolve to captured node IDs
- DOM extremes: 320-level trees, Unicode/graphemes, SVG, MathML, and template content
- Virtualization: replacement windows with observable mutation epochs
- Deterministic chaos: mixed DOM, input, frame, Shadow DOM, scroll, mutation, and network faults with replay and shrinking
- Codec: dictionary-backed TQ1 structure, gzip transport, and exact round trips
- Accessibility and pixels: per-frame ARIA perception graphs plus hashed and maskable screenshot evidence
- Privacy: structural sentinel redaction and pixel-mask invariants
- Driver parity: a real Puppeteer-controlled Chromium session on the shared snapshot contract
- Boundary pressure: generated content, canvas, closed roots, frame churn, hostile hooks, wide DOMs, and repeated sessions

## Required expansion matrix

The next layers should be added as independent scenario packs so failures remain local and shrinkable.

| Pack | Cases |
|---|---|
| DOM extremes | malformed markup repair, million-node width, custom-element upgrade timing, XML documents |
| Components | nested shadow roots, slot reassignment, adopted stylesheets, declarative shadow DOM, closed-root capability declaration |
| Frames/navigation | sandbox flags, srcdoc, detached frames, redirects, history, BFCache, out-of-process frames |
| Interaction | mouse capture, touch, pen, drag/drop, IME/composition, editable ranges, modal/dialog focus traps |
| Rendering | pseudo-elements, clipping, stacking contexts, masks, transforms, zoom, canvas, video, WebGL |
| Accessibility | labels, descriptions, live regions, ownership, hidden/inert rules, invalid ARIA, tree deltas |
| Mutation races | microtasks, animation frames, observers, streaming HTML, hydration, virtualized lists |
| Network | delay, abort, offline, cache, service workers, WebSockets, SSE, partial bodies |
| Security | CSP, Trusted Types, cross-origin isolation, credential redaction modes, hostile page scripts |
| Scale | million-node documents, long sessions, delta chains, memory ceilings, capture latency budgets |

## Walker contract

The production Playwright walker is iterative and bounded; recursion is forbidden for DOM traversal because hostile or generated pages can exceed the JavaScript call-stack depth. It emits a flat node table with stable paths and parent IDs.

`document` mode walks every accessible node up to the declared node/depth budgets. `viewport` mode retains rendered intersections plus their structural ancestors. `focus` mode prioritizes the deeply focused control, its descendants and ancestors, adjacent semantic siblings, associated labels, and remote ARIA dependencies.

Every child browsing context is captured independently through Playwright and linked by:

```text
parent document frameId
    └── iframe node path
            └── child document parentFrameId + ownerPath
```

Cross-origin policy therefore does not erase the child document: Playwright enters its automation context, while the snapshot still preserves the security boundary.

## Snapshot invariants

Every adapter is eventually expected to satisfy:

- Node IDs are unique and every reference resolves.
- Parent/child, host/shadow-root, slot/assignment, frame/document, and accessibility ownership relationships are closed within the declared scope or explicitly marked external.
- Runtime state wins over markup defaults where the browser exposes both.
- Repeated capture without a state transition yields the same canonical semantic hash.
- Full decode is structurally identical to the captured model.
- A delta applied to its declared base equals the corresponding full snapshot.
- Capture never mutates observable page state.
- Unsupported browser capabilities are declared, never silently omitted.
- Truncated, corrupted, oversized, or adversarial input fails safely and with a useful location.

## Artifact contract

Each failed case should eventually emit one self-contained bundle:

```text
run.json                 seed, versions, capabilities, timings
actions.jsonl            ordered automation and logical-clock history
snapshot.tq1             encoded snapshot under test
snapshot.reference.json  canonical oracle
page.png                 visual evidence
trace.zip                Playwright trace
diff.json                first divergent path and invariant failures
replay.sh                exact one-command reproduction
```

This turns “the bot got confused here” into a reproducible state transition with a precise semantic difference.
