import { afterEach, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  currentUser: vi.fn(async () => ({ id: 'user-1' })),
  SessionExpiredError: class SessionExpiredError extends Error {},
}));
vi.mock('@/lib/consent', () => ({
  hasScanConsent: vi.fn(async () => true),
  getChatConsent: vi.fn(async () => false),
  acceptScanConsent: vi.fn(async () => undefined),
  acceptChatConsent: vi.fn(async () => undefined),
}));

import { GET, POST } from './route';
import { acceptChatConsent, acceptScanConsent } from '@/lib/consent';

afterEach(() => vi.clearAllMocks());

test('loads saved consent states for the signed-in user', async () => {
  const response = await GET(new NextRequest('http://localhost/api/consents'));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ scan: true, chat: false });
  const chat = await GET(new NextRequest('http://localhost/api/consents?kind=chat'));
  expect(await chat.json()).toEqual({ chat: false });
});

test('saves each consent only after explicit acceptance', async () => {
  const rejected = await POST(new NextRequest('http://localhost/api/consents', {
    method: 'POST', body: JSON.stringify({ kind: 'chat', accepted: false }),
  }));
  expect(rejected.status).toBe(400);
  expect(acceptChatConsent).not.toHaveBeenCalled();

  const chat = await POST(new NextRequest('http://localhost/api/consents', {
    method: 'POST', body: JSON.stringify({ kind: 'chat', accepted: true }),
  }));
  expect(chat.status).toBe(200);
  expect(acceptChatConsent).toHaveBeenCalledWith('user-1');

  const scan = await POST(new NextRequest('http://localhost/api/consents', {
    method: 'POST', body: JSON.stringify({ kind: 'scan', accepted: true }),
  }));
  expect(scan.status).toBe(200);
  expect(acceptScanConsent).toHaveBeenCalledWith('user-1');
});
