import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const workspaces = [
  'domstamp',
  '@domstamp/tq1',
  '@domstamp/playwright',
  '@domstamp/puppeteer'
];
const rootFiles = new Set(['LICENSE', 'README.md', 'package.json']);
const cacheDirectory = mkdtempSync(join(tmpdir(), 'domstamp-pack-'));

try {
  for (const workspace of workspaces) {
    const output = execFileSync(
      'npm',
      ['pack', '--dry-run', '--json', '--ignore-scripts', '--workspace', workspace],
      {
        encoding: 'utf8',
        env: { ...process.env, npm_config_cache: cacheDirectory }
      }
    );
    if (!output.trim()) {
      throw new Error(`npm returned no tarball manifest for ${workspace}`);
    }

    const [manifest] = JSON.parse(output);
    const paths = manifest.files.map(({ path }) => path);
    for (const required of rootFiles) {
      if (!paths.includes(required)) {
        throw new Error(`${workspace} tarball is missing ${required}`);
      }
    }
    for (const path of paths) {
      if (!rootFiles.has(path) && !path.startsWith('dist/')) {
        throw new Error(`${workspace} tarball contains unexpected path ${path}`);
      }
      if (path.endsWith('.tsbuildinfo')) {
        throw new Error(`${workspace} tarball contains compiler cache ${path}`);
      }
    }
    console.log(`${workspace} tarball: ${paths.length} files, ${manifest.size} bytes`);
  }
} finally {
  rmSync(cacheDirectory, { recursive: true, force: true });
}
