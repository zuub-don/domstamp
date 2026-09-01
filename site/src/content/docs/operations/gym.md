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
- nested, dynamic, cross-origin, and churned instrumented closed Shadow DOM;
- same-origin, cross-origin, and nested frame ownership;
- viewport boundaries, geometry, scrolling, and pointer state;
- Unicode graphemes, SVG, MathML, and template fragments;
- a 320-level tree with explicit node/depth truncation;
- deterministic mutation clocks and virtualized lists;
- ARIA perception graphs and masked screenshot evidence;
- structural secret redaction across DOM, metadata, and accessibility;
- generated CSS content, canvas evidence, and closed-root non-claims;
- detached frame churn and hostile page-prototype failure containment;
- configurable wide documents up to 1,000,000 nodes;
- repeated captures and navigation with observer-reuse assertions;
- a real Puppeteer session against the same cross-origin fixtures;
- seeded mixed-fault chaos.

## Test classes

```bash
npm run test:conformance
npm run test:chaos
npm run test:chromium
npm run test:matrix
```

Public contract tests cover configuration precedence, capability failure, deadlines, cancellation, retry behavior, evidence-provider and plugin order, hostile snapshot validation, schema migration, TQ1 limits, and feature switches.

## Artifacts

Failed runs write Playwright reports and test artifacts under `artifacts/`. Chaos failures additionally include the exact seed, generated plan, checkpoint hashes, replay command, and minimized history where reduction succeeds.

## Adapter integration

The gym’s support layer calls the public `createDomstamp(adapter)` API. New adapters should provide the same public adapter interface and run against this suite rather than forking the assertions.

The default matrix runs every applicable assertion in Chromium, Firefox, and WebKit. The Puppeteer adapter launches the pinned Chromium binary once; non-Chromium projects report that case as intentionally skipped.

Set `DOMSTAMP_SCALE_NODES=1000000` to run the maximum wide-DOM pressure profile. Keep its timing and memory results tied to named CI hardware rather than treating them as universal performance claims.
