// 종이 원서 사진 (상담·신입생 원서): a photo of the paper 입학원서, kept with the 원서 so the teacher who types it into the app
// reads it there. Shrunk on the device: large enough to read the handwriting, small enough for one stored document.
export const INTAKE_PHOTO_RULES = { maxChars: 900_000, maxPhotos: 6 } as const;

/** The photo as a JPEG data URL (longest side 1800px, smaller and lower quality until it fits). */
export async function shrinkFormPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    for (const [side, quality] of [[1800, 0.72], [1600, 0.66], [1400, 0.6], [1200, 0.55]] as const) {
      const scale = Math.min(1, side / Math.max(img.width, img.height)), canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/jpeg', quality);
      if (data.length <= INTAKE_PHOTO_RULES.maxChars) return data;
    }
    throw Error('사진이 너무 커요. 다른 사진으로 해 주세요.');
  } finally { URL.revokeObjectURL(url); }
}
