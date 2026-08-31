---
title: Why Domstamp
description: The problem Domstamp solves and the boundary it deliberately keeps.
---

Browser automation tools are excellent at driving pages. They are less opinionated about preserving the exact state an automation agent used to make a decision.

A raw HTML string is not enough. It omits runtime form values, focus, selections, geometry, computed styles, scroll positions, open Shadow DOM, and cross-frame ownership. A screenshot contains appearance but loses semantics and relationships. An accessibility tree is valuable but represents a different projection of the page.

Domstamp defines one bounded snapshot contract that can include these layers without tying the caller to React, Vue, Angular, Svelte, or a particular driver.

## Architectural boundary

```text
application or agent
        │
        ▼
domstamp core ── validation · limits · retries · plugins
        │
        ▼
typed adapter ── Playwright today; other drivers can implement the contract
        │
        ▼
browser state
```

The core never imports Playwright or an application framework. The adapter target is generic, so a future WebDriver BiDi adapter can accept its own session type without changing the snapshot consumer.

## Why capabilities are explicit

Browser boundaries are not interchangeable. Closed Shadow DOM, a native accessibility tree, pixels, and DOM redaction require different access or capture mechanisms. Every adapter declares what it supports. Domstamp resolves the requested configuration and rejects unsupported combinations before browser work starts.

This prevents a dangerous failure mode: returning a valid-looking snapshot that silently omitted the part the caller depended on.

## What “lossless” means

Lossless means values represented by the schema survive capture and TQ1 round trips exactly. It does **not** mean the library can observe inaccessible browser state.

See [Browser boundaries](/concepts/browser-boundaries/) for the precise current envelope.
