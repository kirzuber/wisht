import { technicalScore } from './photoQuality';

export type PortfolioPhoto = {
  id: string;
  name: string;
  path: string;
  width: number;
  height: number;
  score: number;
  selected: boolean;
  hash: string;
};

export type PreparedPhoto = { meta: PortfolioPhoto; blob: Blob };

export const MAX_PHOTOS = 15;
export const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Converts on device: strips EXIF/location metadata, caps longest side at 1600px. */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!ACCEPTED_TYPES.has(file.type)) throw new Error(`${file.name}: use JPEG, PNG or WebP.`);
  if (file.size > MAX_ORIGINAL_BYTES) throw new Error(`${file.name}: maximum source photo size is 20 MB.`);
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');

  const bitmap = await createImageBitmap(file);
  try {
    const width = bitmap.width, height = bitmap.height;
    if (width < 400 || height < 400) throw new Error(`${file.name}: image is too small for a portfolio.`);
    const scale = Math.min(1, 1600 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Browser image processing is unavailable.');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const sample = document.createElement('canvas');
    sample.width = 64; sample.height = 64;
    const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
    if (!sampleCtx) throw new Error('Browser image analysis is unavailable.');
    sampleCtx.drawImage(canvas, 0, 0, 64, 64);
    const { data } = sampleCtx.getImageData(0, 0, 64, 64);
    const gray = new Float32Array(4096);
    let sum = 0;
    for (let i = 0; i < gray.length; i++) {
      const idx = i * 4;
      const value = 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2];
      gray[i] = value; sum += value;
    }
    const avg = sum / gray.length;
    let sq = 0, diff = 0, count = 0;
    for (let i = 0; i < gray.length; i++) {
      sq += (gray[i] - avg) ** 2;
      if (i % 64 !== 63 && i < 4032) {
        diff += Math.abs(gray[i] - gray[i + 1]) + Math.abs(gray[i] - gray[i + 64]);
        count += 2;
      }
    }
    const score = technicalScore(width, height, avg, Math.sqrt(sq / gray.length), count ? diff / count : 0);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('Could not optimize an image.')), 'image/webp', 0.82)
    );
    if (blob.type !== 'image/webp') throw new Error('This browser cannot export WebP previews.');
    if (blob.size > 6 * 1024 * 1024) throw new Error(`${file.name}: preview exceeds 6 MB.`);
    return { meta: { id: crypto.randomUUID(), name: file.name, path: '', width, height, hash, score, selected: false }, blob };
  } finally {
    bitmap.close();
  }
}
