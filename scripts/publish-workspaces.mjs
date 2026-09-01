import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

if (process.env.CI !== 'true' || process.env.DOMSTAMP_PUBLISH !== '1') {
  throw new Error('Publishing is restricted to the guarded CI release job');
}

const repositoryUrl = 'git+https://github.com/zuub-don/domstamp.git';
const workspacePaths = [
  'packages/domstamp/package.json',
  'packages/tq1/package.json',
  'packages/playwright/package.json',
  'packages/puppeteer/package.json'
];

for (const path of workspacePaths) {
  const manifest = JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
  const identifier = `${manifest.name}@${manifest.version}`;
  const lookup = spawnSync(
    'npm',
    ['view', identifier, 'repository.url', '--json', '--registry=https://registry.npmjs.org/'],
    { encoding: 'utf8' }
  );

  if (lookup.status === 0) {
    const publishedRepository = JSON.parse(lookup.stdout);
    if (publishedRepository !== repositoryUrl) {
      throw new Error(`${identifier} already exists but does not point to ${repositoryUrl}`);
    }
    console.log(`${identifier} is already published from the canonical repository; continuing`);
    continue;
  }

  if (!`${lookup.stdout}\n${lookup.stderr}`.includes('E404')) {
    throw new Error(`Could not verify ${identifier} on npm:\n${lookup.stderr || lookup.stdout}`);
  }

  const publish = spawnSync(
    'npm',
    ['publish', '--workspace', manifest.name, '--access', 'public', '--provenance'],
    { encoding: 'utf8', stdio: 'inherit' }
  );
  if (publish.status !== 0) {
    throw new Error(`Publishing ${identifier} failed with exit code ${publish.status}`);
  }
}
