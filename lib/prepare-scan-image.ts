const uploadLimit = 8 * 1024 * 1024;
const selectionLimit = 35 * 1024 * 1024;
const maxEdge = 2560;

function isHeic(file: File) {
  return /image\/(heic|heif)/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

function standardType(file: File) {
  if (['image/jpeg', 'image/png', 'image/webp'].includes(file.type.toLowerCase())) return file.type.toLowerCase();
  if (/\.(jpe?g)$/i.test(file.name)) return 'image/jpeg';
  if (/\.png$/i.test(file.name)) return 'image/png';
  if (/\.webp$/i.test(file.name)) return 'image/webp';
  return '';
}

export function loadPhoto(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This photo could not be opened. Choose a JPEG, PNG, WebP, or HEIC photo.')); };
    image.src = url;
  });
}

async function jpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('This phone could not prepare the photo. Try another image or browser.');
  return blob;
}

export async function prepareScanImage(selected: File): Promise<{ file: File; width: number; height: number; notice: string }> {
  if (!selected.size || selected.size > selectionLimit) {
    throw new Error('Choose a photo smaller than 35 MB. Large phone photos will be resized before upload.');
  }

  let imageFile = selected;
  let converted = false;
  if (isHeic(selected)) {
    try {
      const { default: heic2any } = await import('heic2any');
      const result = await heic2any({ blob: selected, toType: 'image/jpeg', quality: 0.88 });
      const blob = Array.isArray(result) ? result[0] : result;
      if (!blob) throw new Error('No photo was returned.');
      imageFile = new File([blob], selected.name.replace(/\.(heic|heif)$/i, '') + '.jpg', { type: 'image/jpeg' });
      converted = true;
    } catch {
      throw new Error('This HEIC photo could not be converted on your phone. In Photos, share or export it as JPEG, then try again.');
    }
  } else if (!standardType(selected) && !selected.type.startsWith('image/')) {
    throw new Error('Choose a photo from your gallery or take a new selfie.');
  }

  const image = await loadPhoto(imageFile);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) throw new Error('This photo has no usable image data. Choose another photo.');
  const type = standardType(imageFile);
  if (type && imageFile.size <= uploadLimit && Math.max(width, height) <= maxEdge) {
    return {
      file: imageFile.type === type ? imageFile : new File([imageFile], imageFile.name, { type }),
      width, height,
      notice: converted ? 'iPhone photo converted to JPEG on your device for analysis.' : '',
    };
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This phone could not resize the photo. Try a smaller image.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  let blob = await jpegBlob(canvas, 0.88);
  if (blob.size > uploadLimit) blob = await jpegBlob(canvas, 0.72);
  if (blob.size > uploadLimit) throw new Error('This photo is still too large after resizing. Try a smaller photo.');
  return {
    file: new File([blob], 'skin-scan-photo.jpg', { type: 'image/jpeg' }),
    width: canvas.width,
    height: canvas.height,
    notice: converted ? 'iPhone photo converted and resized on your device for analysis.' : 'Large photo resized on your device for a faster upload.',
  };
}
