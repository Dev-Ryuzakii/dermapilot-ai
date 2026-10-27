export type FaceBox = { originX: number; originY: number; width: number; height: number };
export type CropBox = { x: number; y: number; width: number; height: number };

export function faceCrop(frameWidth: number, frameHeight: number, face: FaceBox): CropBox | null {
  if (frameWidth < 480 || frameHeight < 480 || face.width < 288 || face.height <= 0) return null;
  if (face.originX < 0 || face.originY < 0 || face.originX + face.width > frameWidth || face.originY + face.height > frameHeight) return null;
  // Keep the face roughly 70% of the output width, with space for forehead and chin.
  let width = Math.max(480, face.width / 0.7, face.height * 0.94);
  let height = width * 4 / 3;
  if (width > frameWidth || height > frameHeight) return null;
  const centerX = face.originX + face.width / 2;
  const centerY = face.originY + face.height / 2;
  const x = Math.max(0, Math.min(frameWidth - width, centerX - width / 2));
  const y = Math.max(0, Math.min(frameHeight - height, centerY - height * 0.48));
  if (face.originX < x || face.originX + face.width > x + width || face.originY < y || face.originY + face.height > y + height) return null;
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}
