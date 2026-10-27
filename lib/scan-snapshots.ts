import { AfribaseStorageClient } from '@afribase/afribase-js';
import { apiConfig } from './db';
import { normalizeSnapshotSource, normalizeVisuals } from './youcam';

export const snapshotBucket = 'scan-snapshots';
export type SavedSnapshots = { source: string; visuals: Record<string, string> };

export function snapshotStorage(token: string) {
  const { url, key } = apiConfig();
  return new AfribaseStorageClient({ url: `${url}/storage/v1`, apiKey: key, getAccessToken: () => token });
}

async function uploadOrReuse(files: ReturnType<AfribaseStorageClient['from']>, path: string, bytes: Buffer, type: string) {
  const uploaded = await files.upload(path, bytes, { contentType: type });
  if (!uploaded.error) return true;
  const detail = String(uploaded.error?.message || uploaded.error?.error || '');
  if (/already exists|duplicate|conflict/i.test(detail)) {
    const existing = await files.download(path);
    if (!existing.error && existing.data?.size) return true;
  }
  if (/row.level|permission|unauthorized|policy/i.test(detail)) throw new Error('Afribase denied the photo upload. The scan-snapshots bucket needs an owner-only INSERT policy.');
  throw new Error(`Could not save the scan photo in Afribase Storage${detail ? `: ${detail.slice(0, 120)}` : '.'}`);
}

function trustedResultUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !/^(localhost|.*\.localhost)$/i.test(url.hostname) && !/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) && !url.hostname.includes(':');
  } catch { return false; }
}

async function resultImage(url: string): Promise<{ bytes: Buffer; type: string } | null> {
  if (!trustedResultUrl(url)) return null;
  const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok) return null;
  const length = Number(response.headers.get('content-length') || 0);
  if (length > 8 * 1024 * 1024) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 8 * 1024 * 1024) return null;
  const type = bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? 'image/jpeg'
    : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png'
    : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : null;
  return type ? { bytes, type } : null;
}

function extension(type: string) { return type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'; }

export async function saveScanSnapshots(raw: unknown, original: File | null, token: string, userId: string, scanId: string): Promise<SavedSnapshots> {
  const storage = snapshotStorage(token);
  // Bucket metadata listing is admin-only in Afribase. User JWTs can upload
  // through an owner-only storage.objects policy even when getBucket says 404.
  const files = storage.from(snapshotBucket);
  const prefix = `${userId}/${scanId}`;
  const resizedUrl = normalizeSnapshotSource(raw);
  const resized = resizedUrl ? await resultImage(resizedUrl).catch(() => null) : null;
  if (!resized && !original) throw new Error('The YouCam photo link has expired. Take a new scan to save a photo.');
  const source = resized ?? { bytes: Buffer.from(await original!.arrayBuffer()), type: original!.type };
  const sourcePath = `${prefix}/photo.${extension(source.type)}`;
  await uploadOrReuse(files, sourcePath, source.bytes, source.type);

  const visuals: Record<string, string> = {};
  const candidates = normalizeVisuals(raw).slice(0, 8);
  await Promise.all(candidates.map(async (visual, index) => {
      const image = await resultImage(visual.url).catch(() => null);
      if (!image) return;
      const path = `${prefix}/overlay-${index}.${extension(image.type)}`;
      try { if (await uploadOrReuse(files, path, image.bytes, image.type)) visuals[visual.key] = path; }
      catch { /* A missing overlay must not discard the scan photo. */ }
  }));
  return { source: sourcePath, visuals };
}

export function savedSnapshotMetadata(raw: unknown): SavedSnapshots | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = (raw as Record<string, unknown>)._dermapilot_snapshots;
  if (!value || typeof value !== 'object') return null;
  const metadata = value as Partial<SavedSnapshots>;
  return typeof metadata.source === 'string' && metadata.visuals && typeof metadata.visuals === 'object'
    ? { source: metadata.source, visuals: metadata.visuals } : null;
}
