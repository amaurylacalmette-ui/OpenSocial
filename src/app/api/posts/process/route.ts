import { NextResponse } from 'next/server';
import { processDuePosts } from '@/lib/publisher';

export async function POST() {
  const processed = await processDuePosts();
  return NextResponse.json({ processed });
}
