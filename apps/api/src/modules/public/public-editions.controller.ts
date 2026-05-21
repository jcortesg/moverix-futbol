import { Controller, Get, Param, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Public } from '../../common/decorators/public.decorator'
import { PublicEditionsService } from './public-editions.service'
import * as admin from 'firebase-admin'

@Public()
@ApiTags('public')
@Controller('public/editions')
export class PublicEditionsController {
  constructor(private readonly publicEditionsService: PublicEditionsService) {}

  @Get()
  findAll() {
    return this.publicEditionsService.findAll()
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string, @Req() req: any) {
    // Try to extract uid from optional Bearer token
    let uid: string | undefined
    const [type, token] = req.headers.authorization?.split(' ') ?? []
    if (type === 'Bearer' && token) {
      try {
        const decoded = await admin.auth().verifyIdToken(token)
        uid = decoded.uid
      } catch {
        // Invalid token — treat as anonymous
      }
    }
    return this.publicEditionsService.findBySlug(slug, uid)
  }
}
