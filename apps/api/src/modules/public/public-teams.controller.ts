import { Body, Controller, Get, Param, Post, Query, Req, UnauthorizedException } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Public } from '../../common/decorators/public.decorator'
import { PublicTeamsService } from './public-teams.service'
import * as admin from 'firebase-admin'

async function extractUid(req: any): Promise<string> {
  const [type, token] = req.headers.authorization?.split(' ') ?? []
  if (type !== 'Bearer' || !token) throw new UnauthorizedException('Token requerido')
  try {
    const decoded = await admin.auth().verifyIdToken(token)
    return decoded.uid
  } catch {
    throw new UnauthorizedException('Token inválido')
  }
}

@Public()
@ApiTags('public')
@Controller('public/teams')
export class PublicTeamsController {
  constructor(private readonly service: PublicTeamsService) {}

  /** Join team + register to tournament (requires auth) */
  @Post('join-and-register')
  async joinAndRegister(@Req() req: any, @Body() dto: any) {
    const uid = await extractUid(req)
    const decoded = await admin.auth().verifyIdToken(req.headers.authorization.split(' ')[1])
    return this.service.joinAndRegister(uid, decoded.name ?? decoded.email ?? '', dto)
  }

  /** Get roster for a registration (team director only) */
  @Get('roster/:registrationId')
  async getRoster(
    @Param('registrationId') registrationId: string,
    @Req() req: any,
  ) {
    const uid = await extractUid(req)
    return this.service.getRosterForDirector(uid, registrationId)
  }

  /** Add player to roster manually (team director only) */
  @Post('roster/add-player')
  async addPlayer(@Req() req: any, @Body() dto: any) {
    const uid = await extractUid(req)
    return this.service.addPlayerForDirector(uid, dto)
  }

  /** Get team info by slug (public, no auth required) — MUST be last (wildcard :slug) */
  @Get(':slug')
  getBySlug(
    @Param('slug') slug: string,
    @Query('edition') editionSlug?: string,
  ) {
    return this.service.getTeamBySlug(slug, editionSlug)
  }
}
