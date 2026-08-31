# Contributing

Please use [GitHub Discussions](https://github.com/zuub-don/domstamp/discussions) for design questions and open an issue for reproducible defects or scoped feature proposals. Security reports belong in the private process described in [SECURITY.md](SECURITY.md).

Requirements: Node.js 22 for development and Docker for the complete browser matrix.

```bash
npm install
npm run build
npm run typecheck
npm run test:chromium
docker compose up --build --abort-on-container-exit --exit-code-from runner
```

Public API changes require tests for configuration merging, capabilities, cancellation, errors, and package declarations. Snapshot schema changes require a schema-version decision and compatibility fixture. New adapters must declare capabilities honestly and pass the shared conformance gym.
