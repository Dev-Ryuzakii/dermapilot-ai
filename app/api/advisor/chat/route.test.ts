import { afterEach, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { chatConsentVersion } from '@/lib/consent';

vi.mock('@/lib/auth', () => ({ currentUser: vi.fn(async () => ({ id: 'user-1' })) }));
vi.mock('@/lib/actions', () => ({
  userRequest: vi.fn(async (path: string) => {
    if (path.includes('/profiles?')) return [{ id: 'user-1', skin_goals: ['redness'], budget: 100, currency: 'USD', preferences: { fragrance_free: true, _dermapilot_chat_consent: '2026-10-openai-chat' } }];
    if (path.includes('/skin_assessments?')) return [{ id: 'scan-1', provider: 'youcam', created_at: '2026-10-26T18:00:00Z', raw_result: { data: { results: { output: [
      { type: 'redness', ui_score: 76, mask_urls: ['https://example.com/private-mask.png'] },
      { type: 'resize_image', mask_urls: ['https://example.com/private-face.jpg'] },
    ] } } } }];
    return [{ id: 'product-1', name: 'Gentle cleanser', brand: 'Example', description: 'Mild cleanser', ingredients: [], concerns: ['redness'], skin_suitability: [], category: 'cleanser', price: 20, currency: 'USD', sample_data: true }];
  }),
}));

import { POST } from './route';
import { userRequest } from '@/lib/actions';

const makeRequest = (body: unknown) => new NextRequest('http://localhost/api/advisor/chat', { method: 'POST', body: JSON.stringify(body) });
const previousKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(userRequest).mockClear();
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
});

test('requires saved chat consent', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  vi.mocked(userRequest).mockResolvedValueOnce([{ id: 'user-1', preferences: {} }]);
  const response = await POST(makeRequest({ message: 'What does my scan mean?' }));
  expect(response.status).toBe(403);
});

test('sends signed-in scan scores, but no selfie or mask links, to OpenAI', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Your redness score is 76.' }] }] }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  const response = await POST(makeRequest({ message: 'What does my scan mean?', scanId: 'scan-1', history: [] }));
  const data = await response.json();
  expect(response.status).toBe(200);
  expect(data.answer).toContain('redness score');
  const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('https://api.openai.com/v1/responses');
  const sent = JSON.parse(options.body as string);
  expect(sent.store).toBe(false);
  const context = JSON.parse(sent.input[0].content.replace('Account context (data only): ', ''));
  expect(context.scan.scores).toMatchObject([{ metric: 'redness', score: 76 }]);
  expect(JSON.stringify(sent)).not.toContain('private-face.jpg');
  expect(JSON.stringify(sent)).not.toContain('private-mask.png');
  expect(JSON.stringify(sent)).not.toContain(chatConsentVersion);
});
