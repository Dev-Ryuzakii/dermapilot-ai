import { createClient } from '@afribase/afribase-js';

export function getClient(token?: string) {
  const url = process.env.NEXT_PUBLIC_AFRIBASE_URL || process.env.AFRIBASE_URL;
  const key = process.env.NEXT_PUBLIC_AFRIBASE_ANON_KEY || process.env.AFRIBASE_ANON_KEY;
  if (!url || !key) throw new Error('Afribase project configuration is missing.');
  return createClient(url, key);
}

export function apiConfig() {
  const url = process.env.AFRIBASE_URL || process.env.NEXT_PUBLIC_AFRIBASE_URL;
  const key = process.env.AFRIBASE_ANON_KEY || process.env.NEXT_PUBLIC_AFRIBASE_ANON_KEY;
  if (!url || !key) throw new Error('Afribase project configuration is missing.');
  return { url, key };
}
