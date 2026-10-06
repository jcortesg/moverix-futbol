import { Controller, Get, Req, Res, NotFoundException } from '@nestjs/common'
import type { Request, Response } from 'express'
import { Public } from '../decorators/public.decorator'
import { StorageService, PRIVATE_PREFIX } from '../services/storage.service'

@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Public()
  @Get('*')
  async serveFile(@Req() req: Request, @Res() res: Response) {
    // Extract the GCS path from the URL after /uploads/
    const gcsPath = req.path.replace(/^.*\/uploads\//, '')

    if (!gcsPath) {
      throw new NotFoundException('Ruta de archivo requerida')
    }

    // Los archivos privados (documentos de identidad) NUNCA se sirven por el
    // proxy público — solo por endpoints autenticados con verificación de dueño.
    if (gcsPath === PRIVATE_PREFIX || gcsPath.startsWith(`${PRIVATE_PREFIX}/`)) {
      throw new NotFoundException('Archivo no encontrado')
    }

    if (process.env.NODE_ENV !== 'production') {
      throw new NotFoundException('Use el servidor de archivos estáticos en desarrollo')
    }

    try {
      const { buffer, contentType } = await this.storage.streamFromGcs(gcsPath)
      res.setHeader('Content-Type', contentType)
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      res.send(buffer)
    } catch {
      throw new NotFoundException(`Archivo no encontrado: ${gcsPath}`)
    }
  }
}
