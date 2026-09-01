---
title: Release procedure
description: The guarded path from a versioned source tree to four provenance-backed npm packages.
---

Domstamp releases `domstamp`, `@domstamp/tq1`, `@domstamp/playwright`, and `@domstamp/puppeteer` at one version. Publication is deliberately separate from version preparation: a source tree can be release-ready while npm ownership and protected credentials remain external prerequisites.

## Release invariants

- The Git tag is exactly `v<version>`.
- Every manifest and adapter reports the same version.
- Internal package ranges are `^<version>`.
- The changelog section has an ISO release date.
- Package tarballs contain compiled output, declarations, a README, and the complete license.
- Package audits, API-resolution checks, documentation, and the complete browser gym pass before publication.

`npm run release:check` enforces the static contract. Each package also runs that check from `prepublishOnly`, so a direct publish without the expected release tag fails.

## First-publication setup

The repository owner must complete these external steps once:

1. Claim `domstamp` and establish the `@domstamp` npm organization.
2. Protect `main` and require both CI jobs.
3. Create a protected GitHub environment named `npm` with required reviewers.
4. Add `NPM_TOKEN` to that environment for the bootstrap publication.
5. After the packages exist, configure npm trusted publishing for this repository, the `release.yml` workflow, and the `npm` environment. Remove the bootstrap token when it is no longer required.

An npm 404 suggests a name is unused; it does not prove ownership. The workflow cannot substitute for registry access control.

## Validate a candidate

```bash
RELEASE_TAG=v0.3.0 \
  npm run release:dry-run

docker compose up \
  --build \
  --abort-on-container-exit \
  --exit-code-from runner
```

The dry run validates versions, the changelog, security audit, TypeScript, package builds, documentation, package metadata, type resolution, and tarball contents. Docker runs the pinned two-origin matrix in Chromium, Firefox, and WebKit, plus the real Puppeteer case on Chromium.

## Publish deliberately

After the release commit is on protected `main`, create a GitHub release targeting that exact commit with the matching version tag. Publishing the GitHub release starts the guarded workflow. The `npm` environment approval is the final human checkpoint.

Packages publish in dependency order. If a run stops halfway through, rerunning is safe only when an existing version’s npm metadata points back to the canonical repository. Any conflicting package fails the run.

## Compatibility policy

During `0.x`, a minor release may intentionally change TypeScript APIs or the snapshot schema; a patch release will not intentionally break either. A schema change requires a minor version, release notes, and a migration when the prior representation can be upgraded without inventing evidence. The current reader supports the current schema and at least the two immediately preceding schemas.

At `1.0`, every schema accepted by the `1.0` reader will remain readable throughout `1.x`. Removing that path requires a major package release and prior deprecation notice. Unsupported evidence is represented explicitly rather than synthesized during migration.

## Recovery

npm versions are immutable. Do not overwrite or silently unpublish a defective release. Deprecate it with a precise reason, fix forward with a patch, and use a GitHub security advisory when appropriate.
