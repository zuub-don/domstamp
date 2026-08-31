# @domstamp/tq1

Lossless dictionary encoding with deterministic gzip transport for Domstamp snapshots and other JSON-compatible values.

```bash
npm install @domstamp/tq1
```

```ts
import { decodeTq1, encodeTq1 } from '@domstamp/tq1';

const encoded = encodeTq1(snapshot);
const decoded = decodeTq1(encoded);
```

The decoder enforces configurable compressed, expanded, nesting, string-table, array, and object limits before returning untrusted data. Invalid gzip, tags, indices, duplicate keys, prototype-pollution keys, non-finite numbers, cycles, and unsupported versions fail with a stable `Tq1Error.code`.

```ts
const decoded = decodeTq1(payload, {
  limits: {
    maxCompressedBytes: 8 * 1024 * 1024,
    maxExpandedBytes: 32 * 1024 * 1024,
    maxDepth: 256
  }
});
```

TQ1 is currently a Node-only package because it uses `node:zlib`. It is lossless for JSON-compatible values; class instances, `undefined`, symbols, functions, cyclic graphs, and non-finite numbers are intentionally outside the format.
