import { afterEach, expect, test, vi } from 'vitest';

vi.mock('@/lib/actions', () => ({ userRequest: vi.fn() }));
import { userRequest } from '@/lib/actions';
import { acceptChatConsent, acceptScanConsent, chatConsentVersion, productPreferences, scanConsentVersion } from './consent';

afterEach(() => vi.clearAllMocks());

test('reuses an existing scan consent without writing another record', async () => {
  vi.mocked(userRequest).mockResolvedValueOnce([{ user_id: 'user-1' }]);
  await acceptScanConsent('user-1');
  expect(userRequest).toHaveBeenCalledTimes(1);
  expect(vi.mocked(userRequest).mock.calls[0][0]).toContain(`consent_version=eq.${scanConsentVersion}`);
});

test('keeps existing profile preferences when saving chat consent', async () => {
  vi.mocked(userRequest).mockResolvedValueOnce([{ id: 'user-1', preferences: { fragrance_free: true } }]);
  await acceptChatConsent('user-1');
  const request = vi.mocked(userRequest).mock.calls[1];
  expect(request[0]).toBe('/rest/v1/profiles?on_conflict=id');
  expect(JSON.parse(request[1]?.body as string).preferences).toEqual({
    fragrance_free: true,
    _dermapilot_chat_consent: chatConsentVersion,
  });
  expect(productPreferences(JSON.parse(request[1]?.body as string).preferences)).toEqual({ fragrance_free: true });
});
