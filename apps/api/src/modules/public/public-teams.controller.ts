import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Public } from '../../common/decorators/public.decorator'
import { PublicTeamsService } from './public-teams.service'
import * as admin from 'firebase-admin'

@Public()
@ApiTags('public')
@Controller('public/teams')
export class PublicTeamsController {
  constructor(private readonly service: PublicTeamsService) {}

  /** Get team info by slug (public, no auth required) */
  @Get(':slug')
  getBySlug(
    @Param('slug') slug: string,
    @Query('edition') editionSlug?: string,
  ) {
    return this.service.getTeamBySlug(slug, editionSlug)
  }

  /** Join team + register to tournament (requires auth) */
  @Post('join-and-register')
  async joinAndRegister(@Req() req: any, @Body() dto: any) {
    // This endpoint requires auth but lives under the public controller
    const [type, token] = req.headers.authorization?.split(' ') ?? []
    if (type !== 'Bearer' || !token) {
      throw new (await import('@nestjs/common')).UnauthorizedException('Token requerido')
    }

    let decoded: admin.auth.DecodedIdToken
    try {
      decoded = await admin.auth().verifyIdToken(token)
    } catch {
      throw new (await import('@nestjs/common')).UnauthorizedException('Token inválido')
    }

    return this.service.joinAndRegister(decoded.uid, decoded.name ?? decoded.email ?? '', dto)
  }
}
