---
title: Choose a capture scope
description: Select document, viewport, or focus capture based on the automation task.
---

The scope controls which nodes enter each document snapshot. It does not remove the configured node, depth, frame, byte, or time limits.

## Document

Use `document` when completeness within accessible boundaries matters more than snapshot size.

```ts
await domstamp.capture(page, {
  scope: { mode: 'document' }
});
```

The walker starts at `document.documentElement` unless `root` is a CSS selector.

## Viewport

Use `viewport` for what is currently rendered near the visible window. Matching elements retain their structural ancestors, text, and comments.

```ts
await domstamp.capture(page, {
  scope: { mode: 'viewport', margin: 160 }
});
```

`margin` expands the intersection boundary in CSS pixels. Elements with `display: none` or `visibility: hidden` are excluded by the Playwright adapter.

## Focus

Use `focus` when an agent is blocked around its current control or task context.

```ts
await domstamp.capture(page, {
  scope: {
    mode: 'focus',
    siblingCount: 2,
    includeReferences: true
  }
});
```

Focus scope keeps:

- the deeply focused element, including focus inside open Shadow DOM;
- its accessible subtree and structural ancestors;
- nearby element siblings according to `siblingCount`;
- labels and supported ARIA references when `includeReferences` is enabled.

The result is a compact inward snapshot for diagnosis rather than a lossy text summary.

:::note[No focus]
If the document has no focused element, the selected root becomes the focus anchor.
:::

## Root selectors

Every scope accepts `root`, a CSS selector resolved independently inside each captured document.

```ts
scope: { mode: 'document', root: 'main[aria-label="Checkout"]' }
```

A missing selector is represented as a frame capture error rather than silently falling back to the full document.
