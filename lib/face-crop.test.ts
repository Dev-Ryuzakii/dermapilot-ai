import { expect, test } from 'vitest';
import { faceCrop } from './face-crop';

test('centers a portrait crop on a detected face at usable resolution', () => {
  const face = { originX: 470, originY: 190, width: 340, height: 430 };
  const crop = faceCrop(1280, 960, face);
  expect(crop).not.toBeNull();
  expect(crop!.width).toBeGreaterThanOrEqual(480);
  expect(crop!.height / crop!.width).toBeCloseTo(4 / 3, 1);
  expect(crop!.x).toBeLessThanOrEqual(face.originX);
  expect(crop!.x + crop!.width).toBeGreaterThanOrEqual(face.originX + face.width);
  expect(crop!.y).toBeLessThanOrEqual(face.originY);
  expect(crop!.y + crop!.height).toBeGreaterThanOrEqual(face.originY + face.height);
});

test('rejects a face that cannot fit in a suitable crop', () => {
  expect(faceCrop(1280, 960, { originX: 0, originY: 0, width: 800, height: 700 })).toBeNull();
});
