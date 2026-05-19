#!/usr/bin/env bun
/**
 * Builds the unpacked MV3 extension into `apps/extension/dist/`.
 *
 * Output layout (matches what `chrome://extensions` expects when you
 * "Load unpacked"):
 *   dist/manifest.json
 *   dist/content.js
 *   dist/options.html
 *   dist/icons/icon-{16,48,128}.png
 */

import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const here = new URL('.', import.meta.url).pathname;
const distDir = resolve(here, 'dist');
const iconsSrc = resolve(here, 'icons');
const iconsDst = resolve(distDir, 'icons');

await mkdir(distDir, { recursive: true });
await mkdir(iconsDst, { recursive: true });

const result = await Bun.build({
  entrypoints: [resolve(here, 'src/content.ts')],
  outdir: distDir,
  format: 'iife',
  target: 'browser',
  minify: true,
  naming: '[name].[ext]',
  sourcemap: 'none',
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

await copyFile(resolve(here, 'manifest.json'), resolve(distDir, 'manifest.json'));
await copyFile(resolve(here, 'src/options.html'), resolve(distDir, 'options.html'));

for (const icon of await readdir(iconsSrc)) {
  if (icon.endsWith('.png')) {
    await copyFile(resolve(iconsSrc, icon), resolve(iconsDst, icon));
  }
}

const [output] = result.outputs;
const size = output === undefined ? 0 : output.size;
console.log(`✓ Extension built (${(size / 1024).toFixed(1)} KB content.js + icons) → ${distDir}`);
