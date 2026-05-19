#!/usr/bin/env bun
/**
 * Packages the unpacked dist/ into a Chrome Web Store-ready zip.
 *
 * Usage:
 *   bun apps/extension/scripts/package.ts          # uses version from manifest
 *   bun apps/extension/scripts/package.ts 1.2.3    # overrides version
 *
 * Output:
 *   apps/extension/releases/p2i-extension-v<version>.zip
 *
 * The zip's root should contain `manifest.json` directly (not nested
 * inside a `dist/` folder). Chrome's "Pack extension" tool and the
 * Web Store both expect that layout.
 */

import { mkdir, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const here = new URL('.', import.meta.url).pathname;
const extensionDir = resolve(here, '..');
const distDir = resolve(extensionDir, 'dist');
const releasesDir = resolve(extensionDir, 'releases');

await mkdir(releasesDir, { recursive: true });

// 1. Run the build to ensure dist/ is fresh.
await new Promise<void>((res, reject) => {
  const proc = spawn('bun', ['run', 'build'], { cwd: extensionDir, stdio: 'inherit' });
  proc.on('exit', (code) => (code === 0 ? res() : reject(new Error(`build exited ${code}`))));
});

// 2. Determine version: CLI arg wins, else manifest.json.
const manifest = JSON.parse(await readFile(join(distDir, 'manifest.json'), 'utf-8')) as {
  version?: string;
};
const cliVersion = process.argv[2];
const version = cliVersion ?? manifest.version;
if (typeof version !== 'string' || version === '') {
  console.error('No version specified and manifest.json has no version field.');
  process.exit(1);
}

const zipPath = join(releasesDir, `p2i-extension-v${version}.zip`);
await rm(zipPath, { force: true });

// 3. Zip the dist/ contents (not the dist/ folder itself).
await new Promise<void>((res, reject) => {
  const proc = spawn('zip', ['-r', '-q', zipPath, '.'], { cwd: distDir, stdio: 'inherit' });
  proc.on('exit', (code) => (code === 0 ? res() : reject(new Error(`zip exited ${code}`))));
});

const stat = await Bun.file(zipPath).size;
console.log(`✓ Packaged: ${zipPath} (${(stat / 1024).toFixed(1)} KB)`);
