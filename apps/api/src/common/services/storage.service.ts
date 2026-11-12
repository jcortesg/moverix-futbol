import { Injectable, InternalServerErrorException } from '@nestjs/common'
import * as path from 'path'
import * as fs from 'fs'

const LOCAL_UPLOADS_DIR = path.join(process.cwd(), 'uploads')

// Prefijo reservado para archivos sensibles (documentos de identidad).
// El UploadsController público rechaza este prefijo: solo se sirven por
// endpoints autenticados que verifican propiedad.
export const PRIVATE_PREFIX = 'private'

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

function contentTypeFromExt(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case '.pdf': return 'application/pdf'
    case '.png': return 'image/png'
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.webp': return 'image/webp'
    case '.heic': return 'image/heic'
    default: return 'application/octet-stream'
  }
}

function localBaseUrl(): string {
  return `http://localhost:${process.env.PORT ?? 3001}/uploads`
}

function gcsProxyBaseUrl(): string {
  // En producción las imágenes se sirven a través del proxy del API
  const apiUrl = process.env.API_BASE_URL ?? 'https://api-ftb.moverix.co'
  return `${apiUrl}/ftb/v1/uploads`
}

@Injectable()
export class StorageService {
  async uploadLogo(entityPath: string, file: Express.Multer.File): Promise<string> {
    return this.upload(entityPath, 'logo', file)
  }

  async uploadBanner(entityPath: string, file: Express.Multer.File): Promise<string> {
    return this.upload(entityPath, 'banner', file)
  }

  async deleteFile(publicUrl: string): Promise<void> {
    if (!isProduction()) {
      const base = localBaseUrl()
      if (!publicUrl.startsWith(base)) return
      const filePath = path.join(LOCAL_UPLOADS_DIR, publicUrl.slice(base.length + 1))
      try { fs.rmSync(filePath, { force: true }) } catch { /* best-effort */ }
      return
    }

    // En producción: extraer el path GCS de la URL del proxy
    const base = gcsProxyBaseUrl()
    if (!publicUrl.startsWith(base)) return
    const gcsPath = publicUrl.slice(base.length + 1)

    try {
      const { Storage } = await import('@google-cloud/storage')
      const storage = new Storage()
      const bucket = process.env.GCS_BUCKET ?? 'moverix-assets'
      await storage.bucket(bucket).file(gcsPath).delete({ ignoreNotFound: true })
    } catch {
      // best-effort
    }
  }

  // ── Archivos privados (documentos sensibles) ──────────────────────────────
  // Devuelven/usan una CLAVE de almacenamiento, no una URL pública. El archivo
  // queda bajo el prefijo PRIVATE_PREFIX, que el proxy público rechaza.

  /** Sube un archivo privado y devuelve su clave de almacenamiento. */
  async uploadPrivateDocument(entityPath: string, file: Express.Multer.File, label = 'doc'): Promise<string> {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin'
    const filename = `${label}-${Date.now()}${ext}`
    const key = `${PRIVATE_PREFIX}/${entityPath}/${filename}`

    if (!isProduction()) {
      const abs = path.join(LOCAL_UPLOADS_DIR, key)
      fs.mkdirSync(path.dirname(abs), { recursive: true })
      fs.writeFileSync(abs, file.buffer)
      return key
    }

    try {
      const { Storage } = await import('@google-cloud/storage')
      const storage = new Storage()
      const bucket = process.env.GCS_BUCKET ?? 'moverix-assets'
      await storage.bucket(bucket).file(key).save(file.buffer, {
        contentType: file.mimetype,
        resumable: false,
      })
      return key
    } catch (err) {
      throw new InternalServerErrorException(
        'Error al subir documento: ' + (err as Error).message,
      )
    }
  }

  /** Lee un documento privado por su clave (dev: disco local; prod: GCS). */
  async streamPrivate(key: string): Promise<{ buffer: Buffer; contentType: string }> {
    if (!isProduction()) {
      const abs = path.join(LOCAL_UPLOADS_DIR, key)
      const buffer = fs.readFileSync(abs)
      return { buffer, contentType: contentTypeFromExt(key) }
    }
    return this.streamFromGcs(key)
  }

  /**
   * Copia un documento privado a otra entidad (p. ej. la cédula de un jugador
   * de una inscripción anterior a su fila en una inscripción nueva). Cada fila
   * queda con su propia copia: borrar una no rompe la otra.
   */
  async copyPrivate(srcKey: string, entityPath: string, label = 'doc'): Promise<string> {
    const ext = path.extname(srcKey).toLowerCase() || '.bin'
    const key = `${PRIVATE_PREFIX}/${entityPath}/${label}-${Date.now()}${ext}`

    if (!isProduction()) {
      const dest = path.join(LOCAL_UPLOADS_DIR, key)
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.copyFileSync(path.join(LOCAL_UPLOADS_DIR, srcKey), dest)
      return key
    }

    const { Storage } = await import('@google-cloud/storage')
    const storage = new Storage()
    const bucket = storage.bucket(process.env.GCS_BUCKET ?? 'moverix-assets')
    await bucket.file(srcKey).copy(bucket.file(key))
    return key
  }

  /** Borra un documento privado por su clave. Best-effort. */
  async deletePrivate(key: string): Promise<void> {
    if (!key) return
    if (!isProduction()) {
      try { fs.rmSync(path.join(LOCAL_UPLOADS_DIR, key), { force: true }) } catch { /* best-effort */ }
      return
    }
    try {
      const { Storage } = await import('@google-cloud/storage')
      const storage = new Storage()
      const bucket = process.env.GCS_BUCKET ?? 'moverix-assets'
      await storage.bucket(bucket).file(key).delete({ ignoreNotFound: true })
    } catch {
      // best-effort
    }
  }

  /**
   * Descarga un archivo de GCS y devuelve su contenido + contentType.
   * Usado por el UploadsController para servir imágenes públicamente.
   */
  async streamFromGcs(gcsPath: string): Promise<{ buffer: Buffer; contentType: string }> {
    const { Storage } = await import('@google-cloud/storage')
    const storage = new Storage()
    const bucket = process.env.GCS_BUCKET ?? 'moverix-assets'
    const file = storage.bucket(bucket).file(gcsPath)
    const [metadata] = await file.getMetadata()
    const [buffer] = await file.download()
    return {
      buffer: buffer as Buffer,
      contentType: (metadata.contentType as string) ?? 'application/octet-stream',
    }
  }

  private async upload(
    entityPath: string,
    type: 'logo' | 'banner',
    file: Express.Multer.File,
  ): Promise<string> {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
    const filename = `${type}-${Date.now()}${ext}`

    if (!isProduction()) {
      return this.saveLocally(entityPath, filename, file)
    }

    return this.saveToGcs(entityPath, filename, file)
  }

  private saveLocally(entityPath: string, filename: string, file: Express.Multer.File): string {
    const dir = path.join(LOCAL_UPLOADS_DIR, entityPath)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, filename), file.buffer)
    return `${localBaseUrl()}/${entityPath}/${filename}`
  }

  private async saveToGcs(
    entityPath: string,
    filename: string,
    file: Express.Multer.File,
  ): Promise<string> {
    try {
      const { Storage } = await import('@google-cloud/storage')
      const storage = new Storage()
      const bucket = process.env.GCS_BUCKET ?? 'moverix-assets'
      const destination = `${entityPath}/${filename}`

      await storage.bucket(bucket).file(destination).save(file.buffer, {
        contentType: file.mimetype,
        resumable: false,
        // Sin public:true — se sirve a través del proxy UploadsController
      })

      // Devuelve la URL del proxy (api.moverix.co/uploads/...)
      return `${gcsProxyBaseUrl()}/${destination}`
    } catch (err) {
      throw new InternalServerErrorException(
        'Error al subir imagen: ' + (err as Error).message,
      )
    }
  }
}
