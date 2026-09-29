/** Downscale + re-encode a picked image to a compact JPEG data string. */
export interface EncodedImage {
  /** base64 WITHOUT the data: prefix */
  base64: string
  mimeType: 'image/jpeg'
  /** data:image/jpeg;base64,… — handy for <img> previews and OpenAI-style APIs */
  dataUrl: string
}

// 1000px still resolves receipt text for the model, and keeps the upload small
// enough to finish on mobile data, where the upload — not the model — is
// often what makes a scan time out.
export async function encodeImageForUpload(
  file: File,
  maxDim = 1000,
  quality = 0.55,
): Promise<EncodedImage> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg', dataUrl }
}
