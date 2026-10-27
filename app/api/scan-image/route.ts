import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { anonKey, apiUrl, currentUser, names } from '@/lib/auth';
import { savedSnapshotMetadata, snapshotBucket, snapshotStorage } from '@/lib/scan-snapshots';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get('id') || '';
  const kind = params.get('kind');
  const key = params.get('key') || '';
  if (!/^[a-f\d-]{36}$/i.test(id) || !['source', 'overlay'].includes(kind || '') || (kind === 'overlay' && (!key || key.length > 200 || /[\x00-\x1f]/.test(key)))) {
    return new NextResponse('Invalid image request.', { status: 400 });
  }
  try {
    const token = (await cookies()).get(names.access)?.value;
    if (!token) return new NextResponse('Sign in to view this image.', { status: 401 });
    const user = await currentUser(token);
    const response = await fetch(`${apiUrl()}/rest/v1/skin_assessments?select=id,image_path,raw_result&id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}&limit=1`, {
      headers: { apikey: anonKey(), Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    if (!response.ok) return new NextResponse('Image unavailable.', { status: 502 });
    const scan = (await response.json())?.[0];
    if (!scan) return new NextResponse('Image not found.', { status: 404 });
    const saved = savedSnapshotMetadata(scan.raw_result);
    const path = kind === 'source' ? saved?.source : saved?.visuals[key];
    if (!path || !path.startsWith(`${user.id}/${id}/`)) return new NextResponse('Image not found.', { status: 404 });
    const image = await snapshotStorage(token).from(snapshotBucket).download(path);
    if (image.error || !image.data) return new NextResponse('Image unavailable.', { status: 502 });
    const type = image.data.type || (path.endsWith('.png') ? 'image/png' : path.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) return new NextResponse('Invalid image type.', { status: 502 });
    return new NextResponse(image.data, { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' } });
  } catch {
    return new NextResponse('Image unavailable.', { status: 401 });
  }
}
