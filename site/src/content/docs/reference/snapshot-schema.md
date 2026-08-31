---
title: Snapshot schema
description: Version 1 document, node, relationship, interaction, and consistency fields.
---

Every snapshot carries both a format identifier and schema version.

```ts
interface DomSnapshot {
  readonly format: 'domstamp';
  readonly schemaVersion: 1;
  readonly viewport: { width: number; height: number } | null;
  readonly pointer: { x: number; y: number; type: string; buttons: number } | null;
  readonly framesTruncated: boolean;
  readonly documents: readonly DocumentSnapshot[];
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

## Compatibility

Schema version 1 is a preview contract. Consumers must reject unknown versions. The project has not yet committed to a 1.0 migration or compatibility window.
