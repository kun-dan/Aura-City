export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read image'));
    img.src = src;
  });
}

export async function compressImage(file: File, maxSide = 1024, quality = 0.75): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Compression failed'))), 'image/jpeg', quality),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

async function fingerprint(src: string, size = 24): Promise<{ px: number[]; mean: number; std: number }> {
  const img = await loadImage(src);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, size, size);
  const d = ctx.getImageData(0, 0, size, size).data;
  const px: number[] = [];
  for (let i = 0; i < d.length; i += 4) px.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
  const mean = px.reduce((a, b) => a + b, 0) / px.length;
  const std = Math.sqrt(px.reduce((a, b) => a + (b - mean) ** 2, 0) / px.length);
  return { px, mean, std };
}

export async function compareImages(a: string, b: string): Promise<{ difference: number; correlation: number }> {
  const [fa, fb] = await Promise.all([fingerprint(a), fingerprint(b)]);
  let diff = 0;
  let cov = 0;
  for (let i = 0; i < fa.px.length; i++) {
    diff += Math.abs(fa.px[i] - fb.px[i]);
    cov += (fa.px[i] - fa.mean) * (fb.px[i] - fb.mean);
  }
  const difference = diff / fa.px.length / 255;
  const correlation = fa.std && fb.std ? cov / fa.px.length / (fa.std * fb.std) : 1;
  return { difference, correlation };
}
