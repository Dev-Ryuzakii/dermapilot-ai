import { cookies } from 'next/headers';
import { apiConfig } from './db';

export type Session = { access_token: string; refresh_token: string; expires_in: number; user: { id: string; email: string } };
export class SessionExpiredError extends Error {}
const names = { access: 'dp_access', refresh: 'dp_refresh' };
export const apiUrl = () => apiConfig().url;
export const anonKey = () => apiConfig().key;

async function request(path: string, body: unknown, token?: string) {
  const { url, key } = apiConfig();
  const response = await fetch(`${url}/auth/v1/${path}`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body), cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.msg || data.error_description || data.message || 'Authentication request failed.');
  return data;
}
export async function signIn(email: string, password: string) { return request('token?grant_type=password', { email, password }) as Promise<Session>; }
export async function signUp(email: string, password: string) { return request('signup', { email, password }) as Promise<Partial<Session> & { user?: Session['user'] }>; }
export async function resetPassword(email: string) { return request('recover', { email }); }
export async function signOut(token: string) { return request('logout', {}, token); }
export async function currentUser(token?: string) { if(!token){const jar=await cookies();token=jar.get(names.access)?.value;} if(!token) throw new SessionExpiredError('Sign in to continue.'); const { url, key } = apiConfig(); const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` }, cache: 'no-store' }); if(response.status===401||response.status===403) throw new SessionExpiredError('Your session expired. Sign in again.'); if (!response.ok) throw new Error('Authentication service unavailable.'); return response.json() as Promise<Session['user']>; }
export { names };
