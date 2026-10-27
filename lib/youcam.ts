export type Metric = {
  metric_key: string;
  label: string;
  score: number | null;
  severity: string | null;
  details?: Record<string, unknown>;
};

export type ScanVisual = {
  key: string;
  label: string;
  region: string;
  score: number | null;
  skin_type: string | null;
  url: string;
};
export type SkinTypeObservation = { region: string; value: string };

export type YouCamResult = {
  provider: 'youcam';
  metrics: Metric[];
  summary: string;
  raw: unknown;
};

export class YouCamImageError extends Error {}

const baseUrl = (process.env.YOUCAM_API_BASE_URL || 'https://yce-api-01.makeupar.com').replace(/\/$/, '');
const fileEndpoint = baseUrl + '/s2s/v2.0/file';
const taskEndpoint = baseUrl + '/s2s/v2.0/task/skin-analysis';
const actions = ['moisture', 'texture', 'pore', 'redness', 'skin_type'];
const pollIntervalMs = 3000;
const taskTimeoutMs = 55000;

function bearerHeaders(key: string) {
  return { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
}

async function requestJson(url: string, init: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  } catch {
    throw new Error('Could not reach YouCam. Check the provider connection and try again.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || (typeof data.status === 'number' && data.status >= 400)) {
    const message = data?.error || data?.message || 'YouCam request failed (' + response.status + ').';
    throw new Error('YouCam: ' + String(message));
  }
  return data;
}

export function normalizeMetrics(payload: any): Metric[] {
  const output = payload?.data?.results?.output ?? payload?.results?.output;
  if (!Array.isArray(output)) return [];
  const seen = new Set<string>();
  return output.flatMap((item: any) => {
    if (!item || typeof item !== 'object' || typeof item.type !== 'string') return [];
    const score = item.ui_score ?? item.raw_score;
    if (typeof score !== 'number' || !Number.isFinite(score) || seen.has(item.type)) return [];
    seen.add(item.type);
    return [{
      metric_key: item.type,
      label: item.type.replace(/^hd_/, '').replaceAll('_', ' '),
      score,
      severity: typeof item.severity === 'string' ? item.severity : null,
      details: item,
    }];
  });
}

export function normalizeVisuals(payload: any): ScanVisual[] {
  const output = payload?.data?.results?.output ?? payload?.results?.output;
  if (!Array.isArray(output)) return [];
  const visuals: ScanVisual[] = [];
  for (const item of output) {
    if (!item || typeof item.type !== 'string' || ['all', 'resize_image', 'skin_age'].includes(item.type)) continue;
    if (!Array.isArray(item.mask_urls)) continue;
    const label = item.type.replace(/^hd_/, '').replaceAll('_', ' ');
    const region = typeof item.region === 'string' ? item.region.replaceAll('_', ' ') : 'whole face';
    const score = typeof item.ui_score === 'number' && Number.isFinite(item.ui_score) ? item.ui_score : null;
    for (const [index, url] of item.mask_urls.entries()) {
      if (typeof url !== 'string' || !url.startsWith('https://')) continue;
      visuals.push({
        key: `${item.type}-${region}-${index}`,
        label,
        region,
        score,
        skin_type: typeof item.skin_type === 'string' ? item.skin_type : null,
        url,
      });
    }
  }
  return visuals.slice(0, 40);
}

export function normalizeSkinTypes(payload: any): SkinTypeObservation[] {
  const output = payload?.data?.results?.output ?? payload?.results?.output;
  if (!Array.isArray(output)) return [];
  return output.flatMap((item: any) => {
    if (!item || !['skin_type', 'hd_skin_type'].includes(item.type) || typeof item.skin_type !== 'string' || !item.skin_type.trim()) return [];
    return [{ region: typeof item.region === 'string' ? item.region.replaceAll('_', ' ') : 'whole face', value: item.skin_type }];
  });
}

export function normalizeSnapshotSource(payload: any): string | null {
  const output = payload?.data?.results?.output ?? payload?.results?.output;
  if (!Array.isArray(output)) return null;
  const resized = output.find((item: any) => item?.type === 'resize_image');
  const url = resized?.mask_urls?.[0];
  return typeof url === 'string' && url.startsWith('https://') ? url : null;
}

export async function analyzeWithYouCam(image: File): Promise<YouCamResult> {
  const key = process.env.YOUCAM_API_KEY;
  if (!key) throw new Error('YouCam credentials are missing. Configure YOUCAM_API_KEY securely.');

  const contentType = image.type === 'image/jpeg' ? 'image/jpg' : image.type;
  const extension = image.type === 'image/jpeg' ? 'jpg' : image.type.split('/')[1];
  const fileName = 'skin-scan-' + crypto.randomUUID() + '.' + extension;
  const file = await requestJson(fileEndpoint, {
    method: 'POST',
    headers: bearerHeaders(key),
    body: JSON.stringify({ files: [{ content_type: contentType, file_name: fileName, file_size: image.size }] }),
  });
  const upload = file?.data?.files?.[0];
  const uploadRequest = upload?.requests?.[0];
  if (typeof upload?.file_id !== 'string' || typeof uploadRequest?.url !== 'string' || !uploadRequest.url.startsWith('https://')) {
    throw new Error('YouCam did not provide a valid image upload destination.');
  }

  const bytes = Buffer.from(await image.arrayBuffer());
  let uploaded: Response;
  try {
    uploaded = await fetch(uploadRequest.url, {
      method: uploadRequest.method || 'PUT',
      headers: { ...uploadRequest.headers },
      body: bytes,
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error('Could not upload the image to YouCam. Please retry.');
  }
  if (!uploaded.ok) throw new Error('YouCam image upload failed (' + uploaded.status + '). Please retry.');

  const created = await requestJson(taskEndpoint, {
    method: 'POST',
    headers: bearerHeaders(key),
    body: JSON.stringify({ src_file_id: upload.file_id, dst_actions: actions, format: 'json' }),
  });
  const taskId = created?.data?.task_id;
  if (typeof taskId !== 'string' || !taskId) throw new Error('YouCam did not return an analysis task ID.');

  const deadline = Date.now() + taskTimeoutMs;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    const payload = await requestJson(taskEndpoint + '/' + encodeURIComponent(taskId), {
      method: 'GET', headers: bearerHeaders(key),
    });
    const task = payload?.data ?? payload;
    const status = String(task?.task_status ?? '').toLowerCase();
    if (status === 'error' || status === 'failed') {
      const code = String(task?.error_code || task?.error || task?.error_message || '');
      if (code.includes('error_src_face_too_small')) {
        throw new YouCamImageError('Your face is too small in this photo. Move closer or use Crop closer so your full face fills about 60–80% of the image width, then try again.');
      }
      if (code.includes('error_src_face_out_of_bound')) {
        throw new YouCamImageError('Part of your face is outside the photo. Keep your full face centered and visible, then try again.');
      }
      if (code.includes('error_lighting_dark')) {
        throw new YouCamImageError('This photo is too dark for analysis. Face even, bright light and try again.');
      }
      if (code.includes('error_below_min_image_size')) {
        throw new YouCamImageError('This photo is too small for analysis. Use a higher-resolution image and try again.');
      }
      throw new Error('YouCam analysis failed: ' + (code || 'Please try another clear, front-facing image.'));
    }
    if (status === 'success') {
      const metrics = normalizeMetrics(payload);
      if (!metrics.length) throw new Error('YouCam completed the analysis but returned no skin scores.');
      return {
        provider: 'youcam',
        metrics,
        summary: 'Analysis returned ' + metrics.length + ' visible-skin metrics from YouCam. Cosmetic guidance only, not a medical diagnosis.',
        raw: payload,
      };
    }
  }
  throw new Error('YouCam analysis is taking longer than expected. Please try again shortly.');
}
