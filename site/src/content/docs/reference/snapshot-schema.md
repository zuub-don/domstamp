---
title: Snapshot schema
description: Version 2 DOM, accessibility, attachment, relationship, interaction, and migration fields.
---

Every snapshot carries both a format identifier and schema version.

```ts
interface DomSnapshot {
  readonly format: 'domstamp';
  readonly schemaVersion: 2;
  readonly viewport: { width: number; height: number } | null;
  readonly pointer: { x: number; y: number; type: string; buttons: number } | null;
  readonly framesTruncated: boolean;
  readonly documents: readonly DocumentSnapshot[];
  readonly accessibility: readonly AccessibilityTree[];
  readonly attachments: readonly SnapshotAttachment[];
}
```

## Documents

Each browsing context is independent. IDs are capture-local and unique.

| Field | Meaning |
| --- | --- |
| `frameId` | Capture-local frame identity |
| `parentFrameId` | Parent identity, or `null` for the main frame |
| `ownerPath` | Node path of the iframe element in the parent document |
| `url`, `origin`, `title`, `frameName` | Browsing-context metadata |
| `mode` | Resolved `document`, `viewport`, or `focus` scope |
| `activeNode` | Node ID of deep focus, or `null` |
| `selection` | Anchor/focus node IDs, offsets, and direction |
| `scroll` | Document scroll coordinates |
| `consistency` | Status and mutation epochs |
| `truncated` | Independent node and depth budget flags |
| `nodes` | Flat, ordered node array |

Consistency status is `stable`, `unstable`, `detached`, or `error`.

## Nodes

```ts
interface SnapshotNode {
  readonly id: number;
  readonly parent: number | null;
  readonly depth: number;
  readonly path: string;
  readonly kind: string;
  readonly name: string;
  readonly namespace: string | null;
  readonly value: string | null;
  readonly attributes: ReadonlyArray<readonly [string, string]>;
  readonly references: readonly NodeReference[];
  readonly state: Readonly<Record<string, boolean | number | string | null>>;
  readonly rect: { x: number; y: number; width: number; height: number } | null;
  readonly style: Readonly<Record<string, string>>;
}
```

The representation is flat to keep traversal, validation, serialization, and downstream analysis bounded. `parent` restores the tree.

## Paths

Paths are capture-local structural addresses:

- numeric segments represent ordinary child-node indices;
- `s` crosses into an open shadow root;
- `t` crosses into template content.

Paths are useful for ownership and comparison within the captured structure. They are not durable selectors across arbitrary page mutations.

## References

```ts
interface NodeReference {
  readonly kind: string;
  readonly value: string;
  readonly target: number | null;
}
```

`kind` is the relationship source such as `aria-describedby` or `for`. `value` retains the original target token. `target` resolves to a captured node ID when the target exists inside the snapshot; otherwise it is `null`.

## Runtime state

`state` may include live values that attributes alone cannot represent: current input values, checked and indeterminate state, selected options, text-control selections, `details.open`, content-editable state, tab index, and element scroll offsets.

Canvas elements record their runtime bitmap dimensions and the explicit marker `canvasBitmap: 'pixel-layer-required'`. CSS-generated `::before` and `::after` content is recorded when a same-origin stylesheet exposes a matching rule. Actual canvas, WebGL, media, clipping, and compositing output belongs to the optional pixel attachment.

## Accessibility trees

Each requested tree is linked by `frameId`. Nodes contain a capture-local string ID, parent ID, role, accessible name, description, value, states, and an optional DOM path when the driver can correlate it. `source` distinguishes cross-browser `aria-snapshot` evidence from a future native tree.

## Attachments

Schema 2 defines screenshot attachments with an ID, frame link, PNG or JPEG media type, base64 data, byte length, SHA-256, width, and height. Attachment hashes verify bytes; they are not cross-environment visual-equality promises.

## Compatibility

The current reader accepts schema 1 and 2. Use `inspectSnapshotCompatibility(value)` before loading stored data and `migrateSnapshot(value)` to explicitly convert schema 1 to schema 2. Migration validates the complete resulting graph, adds empty accessibility and attachment arrays, and never fabricates evidence that an older capture did not contain.

Unknown versions fail with `UNSUPPORTED_SCHEMA`. Historical JSON fixtures in the conformance suite prevent accidental removal of the supported migration path. The project has not yet committed to the duration of the post-1.0 compatibility window.
