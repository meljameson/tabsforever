// Adds a released version to updates.json, the Firefox update manifest that
// installed copies poll via `update_url` (see wxt.config.ts).
//
//   node scripts/add-firefox-update.mjs <version> <signed.xpi> <download-url>
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const ADDON_ID = 'tabsforever@meljameson.github.io';
const MANIFEST = new URL('../updates.json', import.meta.url);

const [version, xpiPath, updateLink] = process.argv.slice(2);
if (!version || !xpiPath || !updateLink?.startsWith('https://')) {
  console.error('usage: add-firefox-update.mjs <version> <signed.xpi> <https download url>');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const updates = (manifest.addons[ADDON_ID] ??= { updates: [] }).updates;
if (updates.some((u) => u.version === version)) {
  console.error(`updates.json already lists ${version}`);
  process.exit(1);
}

const hash = createHash('sha256').update(readFileSync(xpiPath)).digest('hex');
updates.push({ version, update_link: updateLink, update_hash: `sha256:${hash}` });
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Added ${version} (sha256:${hash.slice(0, 12)}…)`);
