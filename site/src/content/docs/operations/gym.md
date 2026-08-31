---
title: Conformance gym
description: Run the pinned, two-origin, three-browser laboratory used to validate Domstamp.
---

The gym is a deterministic browser laboratory for evaluating snapshot correctness across real browser engines and hostile document shapes.

## Run the complete matrix

Requirements: Docker with Compose support.

```bash
docker compose build
docker compose run --rm runner npm run test:matrix
```

The runner uses the pinned Playwright image and tests Chromium, Firefox, and WebKit against two isolated origins.

## Scenario coverage

- semantic HTML, comments, hidden and offscreen content;
- runtime form values, focus, selection, and content-editable state;
- open and nested Shadow DOM;
- same-origin, cross-origin, and nested frame ownership;
- viewport boundaries, geometry, scrolling, and pointer state;
- Unicode graphemes, SVG, MathML, and template fragments;
- a 320-level tree with explicit node/depth truncation;
- deterministic mutation clocks and virtualized lists;
- seeded mixed-fault chaos.

## Test classes

```bash
npm run test:conformance
npm run test:chaos
npm run test:chromium
npm run test:matrix
```

Public contract tests cover configuration precedence, capability failure, deadlines, cancellation, retry behavior, plugin order, hostile snapshot validation, TQ1 limits, and feature switches.

## Artifacts

Failed runs write Playwright reports and test artifacts under `artifacts/`. Chaos failures additionally include the exact seed, generated plan, checkpoint hashes, replay command, and minimized history where reduction succeeds.

## Adapter integration

The gym’s support layer calls the public `createDomstamp(adapter)` API. New adapters should provide the same public adapter interface and run against this suite rather than forking the assertions.

Current verified result: **84 tests passing** across all three engines.
