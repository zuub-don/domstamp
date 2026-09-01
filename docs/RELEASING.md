# Releasing Domstamp

Domstamp publishes all four packages at one version. A release is valid only when the Git tag, root manifest, package manifests, adapter metadata, internal dependency ranges, and changelog agree.

## One-time registry setup

Before the first npm publication:

1. Claim `domstamp` and create or obtain control of the `@domstamp` npm organization. A registry 404 is only an availability observation, not ownership.
2. Protect `main` and require the package and browser-matrix CI jobs.
3. Create a protected GitHub environment named `npm` with required reviewers.
4. Add an npm automation token as the environment secret `NPM_TOKEN` for the bootstrap publication.
5. After each package exists, configure npm trusted publishing for `zuub-don/domstamp`, `.github/workflows/release.yml`, and the `npm` environment. Then remove `NPM_TOKEN` if the trusted-publisher setup no longer needs the bootstrap token.

The release workflow requests `id-token: write`, publishes with provenance, and cannot publish until both package validation and the complete Docker browser matrix pass.

## Prepare a version

1. Set the same version in the root and all package manifests.
2. Set every internal `domstamp` dependency range to that version with a caret.
3. Update adapter-reported versions and finalize the changelog heading with an ISO date.
4. Run the guarded local candidate gate:

   ```bash
   RELEASE_TAG=v0.3.0 \
     npm run release:dry-run

   docker compose up \
     --build \
     --abort-on-container-exit \
     --exit-code-from runner
   ```

5. Merge the release commit only after CI is green.

## Publish

Create and publish a GitHub release whose tag is exactly `v<version>`, targeting the verified release commit. Publishing the GitHub release starts `.github/workflows/release.yml`. Approve the protected `npm` environment only after reviewing the package and browser jobs.

The workspace publisher uses dependency order: `domstamp`, `@domstamp/tq1`, `@domstamp/playwright`, then `@domstamp/puppeteer`. A rerun may skip an already-published version only when npm metadata points to the canonical repository; a conflicting package fails closed.

## Verify and recover

Confirm all four versions and provenance attestations on npm, then update `SECURITY.md` and the documentation release status to name the supported npm line.

npm versions are immutable. Do not attempt to overwrite a bad release. Deprecate it with a precise reason, fix forward with a new patch version, and publish a GitHub advisory if the defect affects security.
