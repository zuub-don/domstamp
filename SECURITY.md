# Security policy

## Reporting

Do not open public issues for vulnerabilities. Report them privately through [GitHub Security Advisories](https://github.com/zuub-don/domstamp/security/advisories/new). Include affected versions, reproduction details, impact, and any suggested mitigation. Please allow maintainers time to investigate before public disclosure.

## Threat model

Treat pages and encoded snapshots as untrusted input. A captured page may attempt to exhaust memory, mutate continuously, detach frames, override globals, or expose secrets. A TQ1 payload may attempt decompression bombs, extreme nesting, oversized collections, invalid references, or prototype pollution.

The implementation provides traversal budgets, frame budgets, byte ceilings, timeouts, abort signals, snapshot referential validation, gzip output limits, structural decode limits, and safe definition of hostile object keys. These controls reduce risk but do not make it safe to capture arbitrary hostile websites inside a privileged browser profile.

Use an isolated browser context and container, avoid ambient credentials, configure the smallest required capture surface, and apply an explicit redaction policy before exporting artifacts outside the trust boundary.

## Supported versions

No npm version is currently supported. This section will be updated when the first package is published.
