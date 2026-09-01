import { readFileSync } from 'node:fs';

const rootManifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const version = rootManifest.version;
const tag = process.env.RELEASE_TAG ?? process.env.GITHUB_REF_NAME;

if (!tag) {
  throw new Error('Set RELEASE_TAG to the intended release tag, for example v0.3.0');
}
if (tag !== `v${version}`) {
  throw new Error(`Release tag ${tag} does not match package version ${version}`);
}

const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const heading = changelog.match(new RegExp(`^## ${escapedVersion} — (.+)$`, 'm'));
if (!heading) {
  throw new Error(`CHANGELOG.md has no ${version} section`);
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(heading[1])) {
  throw new Error(`CHANGELOG.md must finalize ${version} with an ISO release date`);
}

const packagePaths = [
  'packages/domstamp/package.json',
  'packages/tq1/package.json',
  'packages/playwright/package.json',
  'packages/puppeteer/package.json'
];

for (const path of packagePaths) {
  const manifest = JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
  if (manifest.version !== version) {
    throw new Error(`${path} has version ${manifest.version}; expected ${version}`);
  }
  if (manifest.private === true) {
    throw new Error(`${path} is marked private`);
  }
  if (manifest.publishConfig?.access !== 'public' || manifest.publishConfig?.provenance !== true) {
    throw new Error(`${path} must publish publicly with provenance`);
  }
  for (const requiredFile of ['dist', 'README.md', 'LICENSE']) {
    if (!manifest.files?.includes(requiredFile)) {
      throw new Error(`${path} does not include ${requiredFile} in its tarball`);
    }
  }
}

console.log(`Release contract is ready for ${tag}`);
