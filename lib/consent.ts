import { userRequest } from '@/lib/actions';

export const scanConsentVersion = '2026-10-snapshots';
export const chatConsentVersion = '2026-10-openai-chat';
const chatConsentKey = '_dermapilot_chat_consent';

type Preferences = Record<string, unknown>;

function preferences(value: unknown): Preferences {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Preferences : {};
}

export function hasChatConsent(value: unknown): boolean {
  return preferences(value)[chatConsentKey] === chatConsentVersion;
}

export function productPreferences(value: unknown): Preferences {
  const { [chatConsentKey]: _consent, ...rest } = preferences(value);
  return rest;
}

export async function hasScanConsent(userId: string): Promise<boolean> {
  const rows = await userRequest(`/rest/v1/scan_consents?select=user_id&user_id=eq.${encodeURIComponent(userId)}&consent_version=eq.${encodeURIComponent(scanConsentVersion)}&consented=eq.true&limit=1`);
  return Array.isArray(rows) && rows.length > 0;
}

export async function acceptScanConsent(userId: string): Promise<void> {
  if (await hasScanConsent(userId)) return;
  await userRequest('/rest/v1/scan_consents', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: userId,
      consent_version: scanConsentVersion,
      consented: true,
      purpose: 'YouCam cosmetic skin analysis and private Afribase snapshot storage',
      granted: true,
      policy_version: scanConsentVersion,
    }),
  });
}

export async function getChatConsent(userId: string): Promise<boolean> {
  const rows = await userRequest(`/rest/v1/profiles?select=id,preferences&id=eq.${encodeURIComponent(userId)}&limit=1`);
  return hasChatConsent(rows?.[0]?.preferences);
}

export async function acceptChatConsent(userId: string): Promise<void> {
  const rows = await userRequest(`/rest/v1/profiles?select=id,preferences&id=eq.${encodeURIComponent(userId)}&limit=1`);
  const profile = rows?.[0];
  if (hasChatConsent(profile?.preferences)) return;
  const record = profile
    ? { id: userId, preferences: { ...preferences(profile.preferences), [chatConsentKey]: chatConsentVersion } }
    : { id: userId, display_name: '', skin_type: '', skin_goals: [], budget: 0, currency: 'NGN', preferences: { [chatConsentKey]: chatConsentVersion } };
  await userRequest('/rest/v1/profiles?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(record),
  });
}
