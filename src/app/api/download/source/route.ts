import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

export const dynamic = 'force-dynamic';

/**
 * Streams the packaged source bundle (opensocial.zip) when one exists in the
 * install — either in public/ or at the project root. A fresh git clone does
 * not ship a .zip inside the repo, so in that case the route explains how to
 * generate one with `npm run pack`.
 */
export async function GET() {
  const candidates = [
    path.join(process.cwd(), 'public', 'opensocial.zip'),
    path.join(process.cwd(), 'opensocial.zip'),
  ];

  const file = candidates.find((p) => existsSync(p));
  if (!file) {
    return Response.json(
      {
        error:
          'No source bundle in this install. Run `npm run pack` (requires the zip CLI) to create opensocial.zip, or grab the project straight from GitHub.',
      },
      { status: 404 },
    );
  }

  const stream = Readable.toWeb(createReadStream(file)) as unknown as ReadableStream<Uint8Array>;

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(statSync(file).size),
      'Content-Disposition': 'attachment; filename="opensocial.zip"',
      'Cache-Control': 'no-store',
    },
  });
}
