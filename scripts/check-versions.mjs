import { readFileSync } from 'node:fs';

const manifests = [
  'package.json',
  'packages/domstamp/package.json',
  'packages/playwright/package.json',
  'packages/puppeteer/package.json',
  'packages/tq1/package.json'
];

const packages = manifests.map((path) => ({
  path,
  manifest: JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'))
}));
const expected = packages[0].manifest.version;

for (const { path, manifest } of packages) {
  if (manifest.version !== expected) {
    throw new Error(`${path} has version ${manifest.version}; expected ${expected}`);
  }
  for (const [name, range] of Object.entries(manifest.dependencies ?? {})) {
    if ((name === 'domstamp' || name.startsWith('@domstamp/')) && range !== `^${expected}`) {
      throw new Error(`${path} depends on ${name}@${range}; expected ^${expected}`);
    }
  }
}

for (const path of ['packages/playwright/src/index.ts', 'packages/puppeteer/src/index.ts']) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  if (!source.includes(`version: '${expected}'`)) {
    throw new Error(`${path} adapter metadata does not report ${expected}`);
  }
}

const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
if (!changelog.includes(`## ${expected} — unreleased`)) {
  throw new Error(`CHANGELOG.md has no unreleased ${expected} section`);
}

console.log(`Version contract is consistent at ${expected}`);
