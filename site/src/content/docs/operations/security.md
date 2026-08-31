---
title: Security and privacy
description: Threat model and deployment guidance for hostile pages and sensitive snapshots.
---

Treat both inspected pages and encoded snapshots as untrusted input.

## Snapshot sensitivity

A lossless snapshot may contain:

- personal data and page text;
- input and textarea values;
- account identifiers and tokens rendered into the DOM;
- URLs, origins, titles, and frame names;
- interaction state that reveals what a user was doing.

Do not export, log, or attach snapshots to model requests without an explicit data policy. The current Playwright adapter does not ship production redaction.

## Hostile-page threat model

A page may attempt to:

- create extreme depth or node counts;
- mutate continuously;
- attach and detach frames;
- return very large text or attribute values;
- override browser globals;
- expose credentials available to the browser profile.

Domstamp provides node, depth, frame, byte, and time ceilings; iterative DOM traversal; cancellation; mutation diagnostics; and structural snapshot validation. These controls reduce risk but do not make a privileged browser profile safe for arbitrary websites.

## TQ1 threat model

An encoded payload may contain invalid gzip, a decompression bomb, extreme nesting, oversized collections, bad string indices, duplicate keys, hostile prototype keys, or an unsupported version.

The decoder applies compressed and expanded byte ceilings plus depth, string-table, array, and object limits. Set smaller application-specific values when decoding across a trust boundary.

## Deployment checklist

- Use a disposable browser context for untrusted pages.
- Do not reuse a profile containing ambient credentials.
- Run browser processes in an appropriately isolated container or sandbox.
- Capture the smallest scope and feature set required by the task.
- Keep frame, node, depth, byte, and time budgets finite.
- Treat artifacts, traces, screenshots, and TQ1 files as sensitive.
- Apply and test a complete redaction layer before data leaves its trust boundary.
- Pin package and browser versions in CI.

## Reporting vulnerabilities

The project must establish a private security-advisory channel before publication. Do not report vulnerabilities through a public issue once that channel exists.
