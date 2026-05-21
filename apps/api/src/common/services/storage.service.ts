import { Injectable, InternalServerErrorException } from '@nestjs/common'
import * as path from 'path'
import * as fs from 'fs'

const LOCAL_UPLOADS_DIR = path.join(process.cwd(), 'uploads')

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
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
    const filename = `${type}${ext}`

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
