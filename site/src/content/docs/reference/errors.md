---
title: Errors and diagnostics
description: Stable Domstamp error codes, recovery guidance, and non-fatal capture diagnostics.
---

Expected library failures are `DomstampError` instances with stable codes.

| Code | Meaning | Typical recovery |
| --- | --- | --- |
| `ABORTED` | Caller signal was aborted | Stop work; retry only if the caller chooses |
| `TIMEOUT` | `limits.timeoutMs` expired | Reduce scope or raise a justified deadline |
| `INVALID_CONFIG` | Settings are structurally or numerically invalid | Correct configuration before retrying |
| `UNSUPPORTED_CAPABILITY` | Adapter cannot satisfy the resolved request | Disable the feature or select another adapter |
| `INVALID_SNAPSHOT` | Adapter or plugin returned malformed or over-budget output | Treat as an integration defect |
| `PLUGIN_FAILED` | A named plugin hook failed | Inspect `details.plugin` and `details.hook` |
| `CAPTURE_FAILED` | Adapter threw an unexpected failure | Inspect `cause` and adapter metadata |

```ts
import { isDomstampError } from 'domstamp';

try {
  await domstamp.capture(page);
} catch (error) {
  if (isDomstampError(error)) {
    switch (error.code) {
      case 'TIMEOUT':
        // Reduce capture scope or apply a task-specific retry policy.
        break;
      case 'UNSUPPORTED_CAPABILITY':
        console.error(error.details.missing);
        break;
      default:
        throw error;
    }
  }
  throw error;
}
```

Do not parse error messages. They are explanatory text, not a stable machine contract.

## Diagnostics

`captureDetailed()` returns non-fatal diagnostics alongside the snapshot. The current core emits `UNSTABLE_CAPTURE` when all configured consistency attempts still contain an unstable document.

```ts
interface CaptureDiagnostic {
  readonly level: 'info' | 'warning';
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}
```
