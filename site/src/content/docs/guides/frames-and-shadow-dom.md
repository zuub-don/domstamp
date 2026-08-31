---
title: Frames and Shadow DOM
description: Capture nested browsing contexts, template fragments, and accessible component boundaries.
---

## Frame graph

The Playwright adapter walks the browser’s frame tree up to `maxFrames`. Every frame is captured independently and connected through metadata:

```ts
interface DocumentSnapshot {
  frameId: string;
  parentFrameId: string | null;
  ownerPath: string | null;
  // ...
}
```

`ownerPath` identifies the iframe element in the parent document. Snapshot validation rejects unresolved parents and frame cycles.

```ts
const snapshot = await domstamp.capture(page, {
  features: {
    frames: { crossOrigin: true, maxFrames: 64 }
  }
});

if (snapshot.framesTruncated) {
  console.warn('The frame budget was reached');
}
```

Setting `crossOrigin: false` compares child origins with the main frame and skips cross-origin descendants. Setting `frames: false` captures only the main document.

## Frame failures remain visible

A detached or inaccessible frame is not silently dropped after collection. It returns a document record with consistency status `detached` or `error` and a `capture-error` node containing the failure message.

## Open Shadow DOM

```ts
features: {
  dom: { shadowRoots: 'open' }
}
```

An open root appears as a `shadow-root` node under its host. Node paths use an `s` segment for the boundary. Deep focus follows nested open roots.

Closed roots are not accessible through `element.shadowRoot`. The Playwright adapter therefore does not advertise `closed-shadow-roots` and rejects `shadowRoots: 'all-available'`.

## Template contents

`HTMLTemplateElement.content` is a detached `DocumentFragment`, not a normal child node. With `templates: true`, Domstamp emits a `document-fragment` child using a `t` path segment, followed by the dormant template content.

```ts
features: {
  dom: { templates: true }
}
```
