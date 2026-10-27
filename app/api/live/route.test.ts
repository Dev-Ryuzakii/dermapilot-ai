import { afterEach, expect, test, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => ({ value: 'signed-in-token' }) }),
}));
vi.mock('@/lib/auth', () => ({
  currentUser: async () => ({ id: 'user-1' }),
  names: { access: 'dp_access' },
  anonKey: () => 'test-anon-key',
  apiUrl: () => 'https://afribase.example.test',
}));

import { GET } from './route';

class FakeWebSocket {
  static OPEN = 1;
  static instance: FakeWebSocket;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  readyState = 1;
  sent: string[] = [];
  closed = false;
  constructor(readonly url: URL) { FakeWebSocket.instance = this; }
  send(message: string) { this.sent.push(message); }
  close() { this.closed = true; }
}

afterEach(() => vi.unstubAllGlobals());

test('relays only the signed-in user’s database change notices', async () => {
  vi.stubGlobal('WebSocket', FakeWebSocket);
  const response = await GET(new Request('http://localhost/api/live'));
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('text/event-stream');
  const reader = response.body!.getReader();
  await reader.read(); // Initial connection notice.

  const socket = FakeWebSocket.instance;
  expect(socket.url.hostname).toBe('afribase.example.test');
  socket.onopen?.();
  const join = JSON.parse(socket.sent[0]);
  expect(join.payload.postgres_changes).toContainEqual(expect.objectContaining({ table: 'skin_assessments', filter: 'user_id=eq.user-1' }));

  socket.onmessage?.({ data: JSON.stringify({ payload: { type: 'postgres_changes', table: 'skin_assessments', new: { user_id: 'other-user' } } }) });
  socket.onmessage?.({ data: JSON.stringify({ payload: { type: 'postgres_changes', table: 'skin_assessments', new: { user_id: 'user-1' } } }) });
  const notice = new TextDecoder().decode((await reader.read()).value);
  expect(notice).toContain('event: change');
  expect(notice).toContain('skin_assessments');
  expect(notice).not.toContain('other-user');
  await reader.cancel();
  expect(socket.closed).toBe(true);
});
