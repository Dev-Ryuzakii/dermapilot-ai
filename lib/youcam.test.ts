import { afterEach, expect, test, vi } from 'vitest';
import { analyzeWithYouCam, YouCamImageError } from './youcam';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test('uploads a file, creates a skin analysis task, and reads returned scores', async () => {
  vi.stubEnv('YOUCAM_API_KEY', 'test-key');
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({
      status: 200,
      data: { files: [{ file_id: 'file-1', requests: [{
        method: 'PUT', url: 'https://uploads.example.test/file-1',
        headers: { 'Content-Type': 'image/png' },
      }] }] },
    }), { status: 200 }))
    .mockResolvedValueOnce(new Response(null, { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      status: 200, data: { task_id: 'task-1' },
    }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      status: 200,
      data: { task_status: 'success', results: { output: [
        { type: 'texture', ui_score: 68, raw_score: 57.33 },
        { type: 'pore', ui_score: 92, raw_score: 95.34 },
      ] } },
    }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);

  const image = new File([new Uint8Array([1, 2, 3])], 'selfie.png', { type: 'image/png' });
  const result = await analyzeWithYouCam(image);

  expect(fetchMock).toHaveBeenCalledTimes(4);
  expect(String(fetchMock.mock.calls[0][0])).toContain('/s2s/v2.0/file');
  expect(fetchMock.mock.calls[1][0]).toBe('https://uploads.example.test/file-1');
  expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({
    src_file_id: 'file-1', format: 'json',
  });
  expect(result.provider).toBe('youcam');
  expect(result.metrics.map(metric => metric.score)).toEqual([68, 92]);
});

test('turns the provider face-size code into actionable photo guidance', async () => {
  vi.stubEnv('YOUCAM_API_KEY', 'test-key');
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ status: 200, data: { files: [{ file_id: 'file-1', requests: [{ method: 'PUT', url: 'https://uploads.example.test/file-1' }] }] } }), { status: 200 }))
    .mockResolvedValueOnce(new Response(null, { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ status: 200, data: { task_id: 'task-1' } }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ status: 200, data: { task_status: 'error', error: 'error_src_face_too_small' } }), { status: 200 })));

  const image = new File([new Uint8Array([1])], 'selfie.png', { type: 'image/png' });
  await expect(analyzeWithYouCam(image)).rejects.toThrow(YouCamImageError);
});
