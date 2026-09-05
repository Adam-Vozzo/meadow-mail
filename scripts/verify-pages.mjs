import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve, sep } from 'node:path';

const root = fileURLToPath(new URL('../dist/pages/', import.meta.url));
const html = readFileSync(join(root, 'index.html'), 'utf8');
assert.ok(
  existsSync(join(root, '.nojekyll')),
  'The Pages artifact must bypass Jekyll.',
);
assert.ok(html.includes('Meadow Mail'), 'The game entry page must be present.');
const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(
  (match) => match[1],
);
assert.ok(
  assets.some((asset) => asset.endsWith('.js')),
  'Missing game JavaScript.',
);
assert.ok(
  assets.some((asset) => asset.endsWith('.css')),
  'Missing game stylesheet.',
);
for (const asset of assets) {
  assert.ok(
    asset.startsWith('./'),
    `Asset must be relative for project Pages: ${asset}`,
  );
  const localPath = resolve(root, asset);
  assert.ok(localPath.startsWith(root.replace(/[\\/]$/, '') + sep));
  assert.ok(existsSync(localPath), `Missing asset: ${asset}`);
}
const chunks = readdirSync(join(root, 'assets')).filter((name) =>
  name.endsWith('.js'),
);
assert.ok(
  chunks.some((name) => name.startsWith('engine-')),
  'Missing lazy-loaded Three.js engine.',
);
for (const chunk of chunks) {
  const source = readFileSync(join(root, 'assets', chunk), 'utf8');
  assert.ok(
    !source.includes('/_next/'),
    `Unexpected server-framework asset URL in ${chunk}`,
  );
}
console.log(
  `GitHub Pages artifact verified: ${assets.length} entry assets and ${chunks.length} JavaScript chunks, all project-path compatible.`,
);
