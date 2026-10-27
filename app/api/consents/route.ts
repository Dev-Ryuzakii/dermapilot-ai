import { NextRequest, NextResponse } from 'next/server';
import { currentUser, SessionExpiredError } from '@/lib/auth';
import { acceptChatConsent, acceptScanConsent, getChatConsent, hasScanConsent } from '@/lib/consent';

function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof SessionExpiredError ? 'Sign in to manage your consent.' : 'Could not save or load your consent. Please try again.' }, { status: error instanceof SessionExpiredError ? 401 : 502 });
}

export async function GET(request: NextRequest) {
  try {
    const kind = request.nextUrl.searchParams.get('kind');
    if (kind && kind !== 'scan' && kind !== 'chat') return NextResponse.json({ error: 'Unknown consent type.' }, { status: 400 });
    const user = await currentUser();
    if (kind === 'scan') return NextResponse.json({ scan: await hasScanConsent(user.id) });
    if (kind === 'chat') return NextResponse.json({ chat: await getChatConsent(user.id) });
    const [scan, chat] = await Promise.all([hasScanConsent(user.id), getChatConsent(user.id)]);
    return NextResponse.json({ scan, chat });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (body?.accepted !== true || !['scan', 'chat'].includes(body.kind)) {
      return NextResponse.json({ error: 'Choose a consent and confirm acceptance.' }, { status: 400 });
    }
    const user = await currentUser();
    if (body.kind === 'scan') await acceptScanConsent(user.id);
    else await acceptChatConsent(user.id);
    return NextResponse.json({ kind: body.kind, saved: true });
  } catch (error) {
    return failure(error);
  }
}
