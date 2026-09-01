---
title: Configuration
description: Complete Domstamp configuration fields, defaults, precedence, and capability effects.
---

## Precedence

From lowest to highest:

1. safe library defaults;
2. capability-safe adapter defaults;
3. defaults passed to `createDomstamp`;
4. defaults added with `withDefaults`;
5. per-capture overrides.

Objects merge by feature. Arrays replace rather than concatenate. `false` disables an optional feature. Persistent defaults use `CaptureSettings`; `CaptureOverrides` adds the one-shot `signal` field.

## Scope

| Mode | Options | Purpose |
| --- | --- | --- |
| `document` | `root?: string` | Bounded exhaustive walk from the selected root |
| `viewport` | `root?: string`, `margin?: number` | Rendered viewport intersections and their ancestors |
| `focus` | `root?: string`, `siblingCount?: number`, `includeReferences?: boolean` | Focused task context, nearby siblings, labels, and ARIA dependencies |

Default: `{ mode: 'document' }`.

## DOM

| Field | Type | Default |
| --- | --- | --- |
| `comments` | `boolean` | `true` |
| `shadowRoots` | `'none' \| 'open' \| 'all-available'` | `'open'` |
| `templates` | `boolean` | `true` |

## Layout

`features.layout` is `false` or:

| Field | Type | Default |
| --- | --- | --- |
| `geometry` | `boolean` | `true` |
| `computedStyles` | `'minimal' \| 'all' \| readonly string[]` | `'minimal'` |

The Playwright adapter’s minimal set covers display, visibility, opacity, positioning, stacking, overflow, pointer behavior, foreground/background color, and core font properties. Adapter option `computedStyleProperties` can replace that minimal list.

## Frames

`features.frames` is `false` or:

| Field | Type | Default |
| --- | --- | --- |
| `crossOrigin` | `boolean` | `true` |
| `maxFrames` | positive safe integer | `128` |

`maxFrames` includes the main document.

## Interaction

`features.interaction` is `false` or contains these independently configurable booleans, all enabled by default:

- `focus`
- `selection`
- `pointer`
- `formState`
- `scroll`

## Accessibility and pixels

```ts
accessibility: false | {
  relationships: boolean;
  tree: boolean;
}

pixels: false | {
  format: 'png' | 'jpeg';
  quality?: number;
  fullPage: boolean;
  scale: 'css' | 'device';
}
```

Default accessibility configuration is `{ relationships: true, tree: false }`. Pixels default to `false`; enabling a partial pixel object fills `format: 'png'`, `fullPage: false`, and `scale: 'css'`. Playwright supports both optional layers. Puppeteer intentionally defaults both to `false` and does not advertise them.

JPEG quality must be an integer from 0 through 100.

## Limits

| Field | Default | Validation |
| --- | ---: | --- |
| `maxNodesPerFrame` | `100_000` | Positive safe integer |
| `maxDepth` | `2_048` | Positive safe integer |
| `maxSnapshotBytes` | `64 MiB` | Positive safe integer |
| `timeoutMs` | `30_000` | Positive safe integer |

Adapter output and plugin output are checked against these ceilings.

## Consistency

```ts
type ConsistencyOptions =
  | { mode: 'best-effort' }
  | { mode: 'verify'; retries: number; settleMs: number };
```

Default: `{ mode: 'verify', retries: 2, settleMs: 16 }`.

## Data policy

```ts
type DataPolicy =
  | { mode: 'lossless' }
  | {
      mode: 'redact';
      inputValues?: boolean;
      text?: readonly string[];
      attributes?: readonly string[];
      urls?: boolean;
      titles?: boolean;
      accessibility?: boolean;
      pixelMasks?: readonly string[];
      pixelMaskColor?: string;
      replacement?: string;
    };
```

Default: `{ mode: 'lossless' }`. Structural redaction is a trusted core transform and therefore does not require adapter support. It covers literal text needles, selected attributes, runtime input values, metadata, styles, references, and accessibility strings according to the policy.

When pixels are enabled, redaction requires at least one `pixelMasks` selector and an adapter advertising `redaction`. Playwright resolves every selector in every captured frame and masks matching regions before screenshot bytes leave the page boundary.

## Playwright adapter settings

```ts
adapter: {
  computedStyleProperties?: readonly string[];
}
```

This list replaces the adapter’s minimal computed-style list when `computedStyles` is not an explicit array.
