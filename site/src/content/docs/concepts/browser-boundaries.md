---
title: Browser boundaries
description: What Domstamp can capture, what requires capabilities, and what remains inaccessible.
---

Domstamp models boundaries explicitly so callers can distinguish “absent in the page” from “not available to this adapter.”

## Current Playwright envelope

| Boundary | Status | Representation |
| --- | --- | --- |
| Light DOM | Supported | Elements, text, comments, attributes, paths, relationships |
| Template contents | Supported | A `document-fragment` below the template path |
| Open Shadow DOM | Supported | A `shadow-root` node and its descendants |
| Closed Shadow DOM | Unavailable | Requires `closed-shadow-roots`; Playwright adapter does not advertise it |
| Same-origin iframe | Supported | Independent `DocumentSnapshot` linked to its owner path |
| Cross-origin iframe | Supported | Independent document through Playwright’s frame execution boundary |
| Runtime form state | Supported | Values, checked/selected state, text selection |
| Geometry and styles | Supported | Bounding rectangles and configured computed properties |
| Native accessibility tree | Unavailable | Modeled as a capability but not implemented by the Playwright adapter |
| Pixels | Unavailable | Modeled as a capability but not implemented by the Playwright adapter |
| Canvas/WebGL internals | Unavailable | Only the canvas DOM element is represented |
| Browser chrome and extension UI | Out of scope | Not page DOM |
| JavaScript heap and closures | Out of scope | Not part of the snapshot schema |

## Iframes are included

Each captured browsing context becomes a document with a stable capture-local `frameId`. Child documents include `parentFrameId` and `ownerPath`, which points to the iframe element in the parent document.

Playwright can evaluate inside cross-origin frames through its automation protocol, so Domstamp does not rely on page JavaScript crossing the same-origin boundary.

```ts
const snapshot = await domstamp.capture(page, {
  features: {
    frames: { crossOrigin: true, maxFrames: 64 }
  }
});
```

Set `frames: false` to capture only the main document, or `crossOrigin: false` to retain same-origin children only.

## Shadow-root policy

- `none`: do not traverse shadow roots.
- `open`: traverse roots available through `element.shadowRoot`.
- `all-available`: requires the adapter to advertise `closed-shadow-roots` in addition to open roots.

The Playwright adapter deliberately rejects `all-available`; treating it as an alias for `open` would be misleading.
