---
title: TQ1 codec
description: Lossless dictionary encoding, gzip transport, decoder limits, and format boundaries.
---

TQ1 is an optional Node-only package for JSON-compatible snapshots and related data.

```bash
npm install @domstamp/tq1
```

```ts
import { encodeTq1, decodeTq1 } from '@domstamp/tq1';

const payload = encodeTq1(snapshot, {
  compressionLevel: 9,
  maxDepth: 512
});

const restored = decodeTq1(payload);
```

## Encoding

TQ1 interns repeated strings into an envelope-level table, represents arrays and objects with tagged sequences, serializes the envelope as JSON, then applies deterministic gzip transport.

It rejects:

- cyclic graphs;
- `NaN` and infinite numbers;
- `undefined`, symbols, functions, and other non-JSON values;
- nesting deeper than the configured limit.

Compression level must be an integer from `-1` through `9`. Depth cannot exceed exported `MAX_TQ1_DEPTH` (`1_024`).

## Defensive decoding

```ts
const value = decodeTq1(payload, {
  limits: {
    maxCompressedBytes: 8 * 1024 * 1024,
    maxExpandedBytes: 32 * 1024 * 1024,
    maxDepth: 256,
    maxStrings: 200_000,
    maxArrayLength: 1_000_000,
    maxObjectProperties: 1_000_000
  }
});
```

Defaults are intentionally generous for large snapshots:

| Limit | Default |
| --- | ---: |
| Compressed bytes | 64 MiB |
| Expanded bytes | 256 MiB |
| Depth | 512 |
| Strings | 1,000,000 |
| Array items | 10,000,000 |
| Object properties | 10,000,000 |

Choose smaller limits at trust boundaries.

The decoder validates gzip output, envelope identity, version, tags, indices, duplicate object keys, scalar types, and structural limits. Object keys including `__proto__` are reconstructed with own-property definitions and cannot mutate the output prototype.

## Errors

`Tq1Error.code` is one of:

- `INVALID_DATA`
- `LIMIT_EXCEEDED`
- `UNSUPPORTED_VERSION`

TQ1 format version and Domstamp schema version are separate compatibility surfaces.
