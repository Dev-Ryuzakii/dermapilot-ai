import { afterEach, expect, test, vi } from 'vitest';

vi.mock('heic2any', () => ({ default: vi.fn(async () => new Blob([new Uint8Array(100)], { type: 'image/jpeg' })) }));
import { prepareScanImage } from './prepare-scan-image';
import heic2any from 'heic2any';

function browserImage(width: number, height: number) {
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:test', revokeObjectURL: vi.fn() });
  vi.stubGlobal('Image', class {
    naturalWidth = width;
    naturalHeight = height;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  });
}

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

test('resizes a large phone photo before upload', async () => {
  browserImage(4032, 3024);
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({ fillRect: vi.fn(), drawImage: vi.fn(), imageSmoothingEnabled: false, imageSmoothingQuality: '', fillStyle: '' }),
    toBlob: (done: (blob: Blob) => void) => done(new Blob([new Uint8Array(1024)], { type: 'image/jpeg' })),
  };
  vi.stubGlobal('document', { createElement: () => canvas });
  const photo = new File([new Uint8Array(9 * 1024 * 1024)], 'phone.jpg', { type: 'image/jpeg' });
  const result = await prepareScanImage(photo);
  expect(result.file.type).toBe('image/jpeg');
  expect(result.file.size).toBeLessThan(8 * 1024 * 1024);
  expect([result.width, result.height]).toEqual([2560, 1920]);
});

test('converts an iPhone HEIC photo locally before analysis', async () => {
  browserImage(1200, 900);
  const photo = new File([new Uint8Array(100)], 'selfie.HEIC', { type: 'image/heic' });
  const result = await prepareScanImage(photo);
  expect(heic2any).toHaveBeenCalledWith(expect.objectContaining({ blob: photo, toType: 'image/jpeg' }));
  expect(result.file.type).toBe('image/jpeg');
  expect(result.file.name).toBe('selfie.jpg');
});
