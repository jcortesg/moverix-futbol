import { NestFactory } from '@nestjs/core'
import { ValidationPipe, VersioningType } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { NestExpressApplication } from '@nestjs/platform-express'
import * as admin from 'firebase-admin'
import * as path from 'path'
import { AppModule } from './app.module'

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID ?? 'moverix',
  })
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  // Serve local uploads in dev (when GCS creds are not configured)
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.NODE_ENV !== 'production') {
    const uploadsDir = path.join(process.cwd(), 'uploads')
    app.useStaticAssets(uploadsDir, { prefix: '/uploads' })
  }

  app.setGlobalPrefix('ftb')
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  })

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Moverix API')
    .setDescription('API para la plataforma de torneos de fútbol amateur Moverix')
    .setVersion('1.0')
    .addBearerAuth()
    .build()

  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('ftb/docs', app, document)

  const port = process.env.PORT ?? 3001
  await app.listen(port, '0.0.0.0')
  console.log(`Moverix API running on port ${port}`)
  console.log(`Swagger docs: http://localhost:${port}/ftb/docs`)
}

bootstrap()
