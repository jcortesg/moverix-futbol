import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { MobileTeamsService } from './mobile-teams.service'

@ApiTags('mobile')
@ApiBearerAuth()
@Controller('mobile/teams')
export class MobileTeamsController {
  constructor(private readonly service: MobileTeamsService) {}

  /** My teams (from team_members) */
  @Get('mine')
  mine(@Req() req: any) {
    return this.service.myTeams(req.user.uid)
  }

  @Get(':id/dashboard')
  dashboard(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.dashboard(id)
  }

  /** Create a new team — caller becomes director + member */
  @Post()
  create(@Req() req: any, @Body() dto: { name: string; shortName?: string; city?: string }) {
    return this.service.createTeam(req.user.uid, req.user.name ?? req.user.email, dto)
  }

  /** Join a team with slug + accessCode */
  @Post('join')
  join(@Req() req: any, @Body() dto: { slug: string; accessCode: string }) {
    return this.service.joinTeam(req.user.uid, req.user.name ?? req.user.email, dto.slug, dto.accessCode)
  }

  /** Get invite info for sharing */
  @Get(':id/invite')
  invite(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.service.getInviteInfo(id, req.user.uid)
  }

  /** Regenerate access code */
  @Post(':id/regenerate-code')
  regenerateCode(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.service.regenerateCode(id, req.user.uid)
  }

  /** Get team members */
  @Get(':id/members')
  members(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getMembers(id)
  }

  /** Remove a member (director only) */
  @Delete(':id/members/:memberUid')
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberUid') memberUid: string,
    @Req() req: any,
  ) {
    return this.service.removeMember(id, memberUid, req.user.uid)
  }

  /** Leave a team */
  @Delete(':id/leave')
  leave(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.service.leaveTeam(id, req.user.uid)
  }

  /** Registration detail (team + championship) */
  @Get('registration/:registrationId')
  registrationDetail(@Param('registrationId', ParseUUIDPipe) registrationId: string) {
    return this.service.getRegistrationDetail(registrationId)
  }

  /** Register team to an edition (director only) */
  @Post(':teamId/register/:editionId')
  register(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('editionId', ParseUUIDPipe) editionId: string,
    @Req() req: any,
  ) {
    return this.service.registerTeam(teamId, editionId, req.user.uid)
  }

  /** Add players from global roster to tournament roster */
  @Post('registration/:registrationId/add-players')
  addPlayers(
    @Param('registrationId', ParseUUIDPipe) registrationId: string,
    @Body() dto: { playerUids: string[] },
    @Req() req: any,
  ) {
    return this.service.addPlayersToRegistration(registrationId, dto.playerUids, req.user.uid)
  }

  /** Remove player from tournament roster */
  @Delete('registration/:registrationId/players/:playerUid')
  removePlayer(
    @Param('registrationId', ParseUUIDPipe) registrationId: string,
    @Param('playerUid') playerUid: string,
    @Req() req: any,
  ) {
    return this.service.removePlayerFromRegistration(registrationId, playerUid, req.user.uid)
  }

  /** Financials: fines + payments for a registration */
  @Get('registration/:registrationId/financials')
  financials(@Param('registrationId', ParseUUIDPipe) registrationId: string) {
    return this.service.getFinancials(registrationId)
  }
}
