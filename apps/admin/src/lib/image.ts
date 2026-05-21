// Downscale an image client-side before uploading.
// Preserves aspect ratio. Re-encodes as JPEG (or PNG if the source has alpha).
export async function resizeImage(
  file: File,
  opts: { maxSize: number; quality?: number } = { maxSize: 512, quality: 0.9 },
): Promise<File> {
  const { maxSize, quality = 0.9 } = opts

  // If already small, skip work
  if (file.size < 256 * 1024) return file

  const dataUrl = await readAsDataUrl(file)
  const img = await loadImage(dataUrl)

  const longestSide = Math.max(img.naturalWidth, img.naturalHeight)
  if (longestSide <= maxSize) return file // already small enough by dimension

  const scale = maxSize / longestSide
  const targetW = Math.round(img.naturalWidth * scale)
  const targetH = Math.round(img.naturalHeight * scale)

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(img, 0, 0, targetW, targetH)

  const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), mime, quality),
  )
  if (!blob) return file

  const baseName = file.name.replace(/\.[^.]+$/, '')
  const ext = mime === 'image/png' ? 'png' : 'jpg'
  return new File([blob], `${baseName}.${ext}`, { type: mime })
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
    img.src = src
  })
}
