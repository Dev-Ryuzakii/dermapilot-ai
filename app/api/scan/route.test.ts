import { afterEach, expect, test, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => ({ value: 'session-token' }) }),
}));
vi.mock('@/lib/auth', () => ({
  apiUrl: () => 'https://afribase.example.test',
  anonKey: () => 'test-anon-key',
  currentUser: async () => ({ id: 'user-1' }),
  names: { access: 'dp_access' },
}));
vi.mock('@/lib/youcam', () => ({
  YouCamImageError: class YouCamImageError extends Error {},
  analyzeWithYouCam: vi.fn(async () => ({
    provider: 'youcam',
    metrics: [],
    summary: 'Five skin metrics returned.',
    raw: { data: { task_status: 'success' } },
  })),
}));
vi.mock('@/lib/scan-snapshots', () => ({
  saveScanSnapshots: vi.fn(async () => { throw new Error('Storage is unavailable.'); }),
}));

import { POST } from './route';
import { analyzeWithYouCam, YouCamImageError } from '@/lib/youcam';
import { saveScanSnapshots } from '@/lib/scan-snapshots';

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

test('analyzes a consented scan without Afribase Storage', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(null, { status: 201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'assessment-1' }]), {
      status: 201, headers: { 'Content-Type': 'application/json' },
    }));
  vi.stubGlobal('fetch', fetchMock);

  const form = new FormData();
  form.set('image', new File([new Uint8Array([1])], 'selfie.png', { type: 'image/png' }));
  form.set('consent', 'true');
  const response = await POST(new Request('http://localhost/api/scan', { method: 'POST', body: form }));

  expect(response.status).toBe(200);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls.map(call => String(call[0]))).toEqual([
    'https://afribase.example.test/rest/v1/scan_consents',
    'https://afribase.example.test/rest/v1/skin_assessments',
  ]);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ image_path: 'not-stored' });
  expect(await response.json()).toMatchObject({ assessment_id: 'assessment-1' });
});

test('attaches private snapshot paths to the saved assessment', async () => {
  vi.mocked(saveScanSnapshots).mockResolvedValueOnce({ source: 'user-1/assessment-1/photo.jpg', visuals: { 'pore-whole face-0': 'user-1/assessment-1/overlay-0.png' } });
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(null, { status: 201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'assessment-1' }]), { status: 201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'assessment-1' }]), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  const form = new FormData();
  form.set('image', new File([new Uint8Array([1])], 'selfie.png', { type: 'image/png' }));
  form.set('consent', 'true');
  const response = await POST(new Request('http://localhost/api/scan', { method: 'POST', body: form }));
  expect(response.status).toBe(200);
  const patch = fetchMock.mock.calls[2];
  expect(patch[1].method).toBe('PATCH');
  expect(JSON.parse(patch[1].body)).toMatchObject({ image_path: 'user-1/assessment-1/photo.jpg', raw_result: { _dermapilot_snapshots: { source: 'user-1/assessment-1/photo.jpg' } } });
  expect(await response.json()).toMatchObject({ assessment_id: 'assessment-1' });
});

test('returns a photo guidance error for a face that is too small', async () => {
  vi.mocked(analyzeWithYouCam).mockRejectedValueOnce(new YouCamImageError('Move closer to the camera.'));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 201 })));
  const form = new FormData();
  form.set('image', new File([new Uint8Array([1])], 'selfie.png', { type: 'image/png' }));
  form.set('consent', 'true');

  const response = await POST(new Request('http://localhost/api/scan', { method: 'POST', body: form }));

  expect(response.status).toBe(422);
  expect(await response.json()).toMatchObject({ error: 'Move closer to the camera.' });
});
