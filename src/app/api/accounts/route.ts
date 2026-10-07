import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createVerifiedAccount } from '@/lib/account-service';
import { PlatformError } from '@/lib/adapters';

export async function GET() {
  const accounts = await db.socialAccount.findMany({
    orderBy: { connectedAt: 'asc' },
    include: { _count: { select: { targets: true } } },
  });
  // Credentials never leave the server.
  return NextResponse.json({ accounts: accounts.map(({ credentials: _c, ...rest }) => rest) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { platform, credentials } = body as { platform?: string; credentials?: Record<string, string> };

  if (!credentials || typeof credentials !== 'object') {
    return NextResponse.json({ error: 'Credentials are required — every connection is verified against the live platform API.' }, { status: 400 });
  }

  try {
    const account = await createVerifiedAccount(platform ?? '', credentials);
    return NextResponse.json({ account }, { status: 201 });
  } catch (e) {
    const status = e instanceof PlatformError && e.status ? e.status : 400;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
