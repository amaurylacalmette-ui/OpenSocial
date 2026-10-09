/**
 * v1.1.2 — cross-platform replacement for the Unix-only `cp -r` pipeline in
 * the build script. Copies the assets Next's standalone output needs next to
 * the bundled server so `node .next/standalone/server.js` can serve them.
 * Runs automatically after `next build` (npm "postbuild" lifecycle).
 */
import { cpSync, existsSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const staticSrc = new URL('./.next/static/', root);
const staticDst = new URL('./.next/standalone/.next/static/', root);
const publicSrc = new URL('./public/', root);
const publicDst = new URL('./.next/standalone/public/', root);

if (!existsSync(new URL('./.next/standalone/', root))) {
  console.warn('[OpenSocial] No standalone build found — skipping standalone asset copy.');
  process.exit(0);
}

cpSync(staticSrc, staticDst, { recursive: true });
cpSync(publicSrc, publicDst, { recursive: true });
console.log('[OpenSocial] Standalone ready: static assets + public copied.');
