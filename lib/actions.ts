import { cookies } from 'next/headers';
import { anonKey, apiUrl, names, currentUser } from './auth';

export async function userRequest(path: string, init: RequestInit = {}) {
  const jar = await cookies();
  const token = jar.get(names.access)?.value;
  if (!token) throw new Error('Sign in to continue.');
  const response = await fetch(`${apiUrl()}${path}`, { ...init, headers: { apikey: anonKey(), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...init.headers }, cache: 'no-store' });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Afribase request failed (${response.status}).`);
  return text ? JSON.parse(text) : null;
}
export async function signedInUser() { const jar = await cookies(); const token = jar.get(names.access)?.value; return token ? currentUser(token).catch(() => null) : null; }
