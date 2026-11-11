/**
 * OCR for "Quick fill from photo": Tesseract (tesseract.js, WebAssembly) reads a photo of a donor's note,
 * label or packing slip IN THE BROWSER — the photo never leaves the device. Only the recognised text is then
 * sent to /api/donations/extract, which removes phone numbers and emails before any AI model sees it.
 */

export const OCR_MAX_CHARS = 500;
const MAX_SIDE = 1600; // downscale big phone photos: faster OCR, same accuracy for printed/handwritten notes

/** Turn raw OCR output into one clean line the extractor understands (also used by scripts/ocr-test.ts). */
export function cleanOcrText(raw: string): string {
  return raw
    .replace(/[|_~`^<>{}\[\]\\]/g, ' ') // characters OCR invents from table lines and noise
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 1 && /[a-z0-9]/i.test(l))
    .join(', ')
    .replace(/,\s*,/g, ',')
    .replace(/:\s*,/g, ':')
    .slice(0, OCR_MAX_CHARS)
    .trim();
}

async function downscale(file: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  if (scale === 1) return file;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/png'));
}

/** Browser only. Reads the text in a photo; reports progress 0-100. */
export async function readPhotoText(file: Blob, onProgress?: (pct: number) => void): Promise<{ text: string; confidence: number }> {
  const { createWorker } = await import('tesseract.js'); // loaded only when a donor actually picks a photo
  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(Math.round(m.progress * 100));
    },
  });
  try {
    const { data } = await worker.recognize(await downscale(file));
    return { text: cleanOcrText(data.text), confidence: Math.round(data.confidence) };
  } finally {
    await worker.terminate();
  }
}
