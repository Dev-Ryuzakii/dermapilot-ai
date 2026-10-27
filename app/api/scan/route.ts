import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { apiUrl, anonKey, currentUser, names } from '@/lib/auth';
import { analyzeWithYouCam, YouCamImageError } from '@/lib/youcam';
import { saveScanSnapshots } from '@/lib/scan-snapshots';
import { hasScanConsent } from '@/lib/consent';

export const runtime = 'nodejs';
export const maxDuration = 120;
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const result = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  const started = Date.now();
  let uid = '';
  let provider = 'youcam';
  let token = '';
  try {
    token = (await cookies()).get(names.access)?.value || '';
    if (!token) return result('Your session expired. Sign in again, then retry the scan.', 401);
    const user = await currentUser(token);
    uid = user.id;
    const form = await request.formData();
    const image = form.get('image');
    if (!(image instanceof File) || !imageTypes.has(image.type) || image.size === 0 || image.size > 8 * 1024 * 1024) return result('Choose a JPEG, PNG, or WebP image smaller than 8 MB.', 400);
    if (!(await hasScanConsent(uid))) return result('Review and accept scan consent before processing your image.', 403);
    const api = apiUrl();
    const key = anonKey();

    const analysis = await analyzeWithYouCam(image);
    provider = analysis.provider;
    const saved = await fetch(`${api}/rest/v1/skin_assessments`, {
      method: 'POST', cache: 'no-store',
      headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: uid, provider, status: 'completed', summary: analysis.summary, raw_result: analysis.raw, image_path: 'not-stored', completed_at: new Date().toISOString() }),
    });
    if (!saved.ok) {
      const detail = await saved.text().catch(() => '');
      throw new Error(`Could not save scan results (${saved.status}). ${detail.slice(0, 140)}`);
    }
    const rows = await saved.json();
    const assessment = rows?.[0];
    if (!assessment?.id) throw new Error('The scan completed but no assessment record was returned.');
    let snapshotWarning: string | undefined;
    try {
      const snapshots = await saveScanSnapshots(analysis.raw, image, token, uid, assessment.id);
      const raw = { ...(analysis.raw as Record<string, unknown>), _dermapilot_snapshots: snapshots };
      const updated = await fetch(`${api}/rest/v1/skin_assessments?id=eq.${encodeURIComponent(assessment.id)}&user_id=eq.${encodeURIComponent(uid)}`, {
        method: 'PATCH', cache: 'no-store',
        headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ raw_result: raw, image_path: snapshots.source }),
      });
      if (!updated.ok || !(await updated.json().catch(() => []))?.length) throw new Error('Could not attach the saved photos to the scan.');
    } catch (error) {
      snapshotWarning = error instanceof Error ? error.message : 'Could not save scan snapshots.';
    }
    return NextResponse.json({ assessment_id: assessment.id, provider, metrics: analysis.metrics, summary: analysis.summary, snapshot_warning: snapshotWarning });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The scan could not be completed. Please try again.';
    const status = error instanceof YouCamImageError ? 422 : /session|sign in|not authenticated/i.test(message) ? 401 : 502;
    if (uid && token) {
      const config = apiUrl();
      void fetch(`${config}/rest/v1/api_usage_events`, {
        method: 'POST', cache: 'no-store',
        headers: { apikey: anonKey(), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ user_id: uid, provider, action: 'skin_scan', success: false, duration_ms: Date.now() - started, error_code: status === 401 ? 'auth' : 'scan_failed', metadata: { message: message.slice(0, 200) } }),
      }).catch(() => undefined);
    }
    return result(message, status);
  }
}
