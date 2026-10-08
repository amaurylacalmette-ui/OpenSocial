/**
 * v1.1.1 "Quick install" — zero-setup bootstrap.
 *
 * Runs automatically on `npm install` (postinstall) and before every
 * `npm run dev` (predev). Creates .env from .env.example on first run so the
 * 4-command quick start (clone → install → dev) needs no manual copy step.
 */
import { copyFileSync, existsSync, readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const example = new URL('.env.example', root);
const env = new URL('.env', root);

if (!existsSync(env)) {
  copyFileSync(example, env);
  console.log('[OpenSocial] Created .env from .env.example — done. Platform & AI keys are added in the app (Settings), not in this file.');
} else if (process.env.OS_VERBOSE_SETUP === '1') {
  console.log('[OpenSocial] .env already exists — leaving it untouched.');
}

// Prisma resolves relative SQLite paths against prisma/schema.prisma; make sure
// the db directory exists so a first `prisma db push` can never fail on it.
const dbDir = new URL('./db/', root);
if (!existsSync(dbDir)) {
  const { mkdirSync } = await import('node:fs');
  mkdirSync(dbDir, { recursive: true });
}

// Fail fast (and clearly) if the lockfile-less runtime can't find prisma —
// this only happens when scripts are run outside an installed project.
try {
  readFileSync(new URL('./node_modules/prisma/package.json', root));
} catch {
  console.warn('[OpenSocial] prisma not found in node_modules — run `npm install` first.');
}
