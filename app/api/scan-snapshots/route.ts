import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { anonKey, apiUrl, currentUser, names } from '@/lib/auth';
import { saveScanSnapshots, savedSnapshotMetadata } from '@/lib/scan-snapshots';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === 'string' ? body.id : '';
  if (!/^[a-f\d-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid scan.' }, { status: 400 });
  try {
    const token = (await cookies()).get(names.access)?.value;
    if (!token) return NextResponse.json({ error: 'Sign in to save these images.' }, { status: 401 });
    const user = await currentUser(token);
    const api = apiUrl();
    const headers = { apikey: anonKey(), Authorization: `Bearer ${token}` };
    const response = await fetch(`${api}/rest/v1/skin_assessments?select=id,raw_result&id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`, { headers, cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load this scan.');
    const scan = (await response.json())?.[0];
    if (!scan) return NextResponse.json({ error: 'Scan not found.' }, { status: 404 });
    if (savedSnapshotMetadata(scan.raw_result)) return NextResponse.json({ saved: true });
    const snapshots = await saveScanSnapshots(scan.raw_result, null, token, user.id, id);
    const updated = await fetch(`${api}/rest/v1/skin_assessments?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}`, {
      method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' }, cache: 'no-store',
      body: JSON.stringify({ raw_result: { ...scan.raw_result, _dermapilot_snapshots: snapshots }, image_path: snapshots.source }),
    });
    if (!updated.ok || !(await updated.json().catch(() => []))?.length) throw new Error('Could not attach the saved images to this scan.');
    return NextResponse.json({ saved: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not save these images.' }, { status: 502 });
  }
}
