import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req, Res,
  UploadedFile, UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import type { Response } from 'express'
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger'
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

  @Get(':id')
  profile(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.profile(id)
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

  /** Join a team with a single invite code */
  @Post('join')
  join(@Req() req: any, @Body() dto: { code?: string; accessCode?: string }) {
    return this.service.joinTeam(req.user.uid, req.user.name ?? req.user.email, dto.code ?? dto.accessCode ?? '')
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

  /** Nombrar / quitar delegado adicional (solo el delegado principal) */
  @Patch(':id/members/:memberUid/delegate')
  setDelegate(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberUid') memberUid: string,
    @Body() body: { delegate: boolean },
    @Req() req: any,
  ) {
    return this.service.setMemberDelegate(id, memberUid, body?.delegate === true, req.user.uid)
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

  /** Invite code for this registration — invitee lands directly in this roster (director only) */
  @Get('registration/:registrationId/invite')
  registrationInvite(
    @Param('registrationId', ParseUUIDPipe) registrationId: string,
    @Req() req: any,
  ) {
    return this.service.getRegistrationInvite(registrationId, req.user.uid)
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

  /** Roster de la inscripción (DT o miembro del equipo) */
  @Get('registration/:registrationId/players')
  registrationPlayers(
    @Param('registrationId', ParseUUIDPipe) registrationId: string,
    @Req() req: any,
  ) {
    return this.service.getRegistrationPlayers(registrationId, req.user.uid)
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

  /** Update a registration player's detail fields (director or the player) */
  @Patch('registration/:registrationId/players/:playerUid')
  updatePlayer(
    @Param('registrationId', ParseUUIDPipe) registrationId: string,
    @Param('playerUid') playerUid: string,
    @Body() dto: Record<string, unknown>,
    @Req() req: any,
  ) {
    return this.service.updateRegistrationPlayer(registrationId, playerUid, dto, req.user.uid)
  }

  // ── Archivos del jugador: documento y foto (director o el propio jugador) ──

  @Post('registration/:registrationId/players/:playerUid/document')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadPlayerDocument(
    @Param('registrationId', ParseUUIDPipe) registrationId: string,
    @Param('playerUid') playerUid: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.service.uploadPlayerFile(registrationId, playerUid, 'document', file, req.user.uid)
  }

  @Get('registration/:registrationId/players/:playerUid/document')
  async getPlayerDocument(
    @Param('registrationId', ParseUUIDPipe) registrationId: string,
    @Param('playerUid') playerUid: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const { buffer, contentType } = await this.service.getPlayerFile(registrationId, playerUid, 'document', req.user.uid)
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'private, no-store')
    res.send(buffer)
  }

  @Delete('registration/:registrationId/players/:playerUid/document')
  removePlayerDocument(
    @Param('registrationId', ParseUUIDPipe) registrationId: string,
    @Param('playerUid') playerUid: string,
    @Req() req: any,
  ) {
    return this.service.removePlayerFile(registrationId, playerUid, 'document', req.user.uid)
  }

  @Post('registration/:registrationId/players/:playerUid/photo')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadPlayerPhoto(
    @Param('registrationId', ParseUUIDPipe) registrationId: string,
    @Param('playerUid') playerUid: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.service.uploadPlayerFile(registrationId, playerUid, 'photo', file, req.user.uid)
  }

  @Get('registration/:registrationId/players/:playerUid/photo')
  async getPlayerPhoto(
    @Param('registrationId', ParseUUIDPipe) registrationId: string,
    @Param('playerUid') playerUid: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const { buffer, contentType } = await this.service.getPlayerFile(registrationId, playerUid, 'photo', req.user.uid)
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'private, no-store')
    res.send(buffer)
  }

  @Delete('registration/:registrationId/players/:playerUid/photo')
  removePlayerPhoto(
    @Param('registrationId', ParseUUIDPipe) registrationId: string,
    @Param('playerUid') playerUid: string,
    @Req() req: any,
  ) {
    return this.service.removePlayerFile(registrationId, playerUid, 'photo', req.user.uid)
  }

  /** Submit the registration for review (draft → pending) — director only */
  @Post('registration/:registrationId/submit')
  submit(
    @Param('registrationId', ParseUUIDPipe) registrationId: string,
    @Req() req: any,
  ) {
    return this.service.submitRegistration(registrationId, req.user.uid)
  }

  /** Roster status: cuenta de jugadores + qué falta para completar la inscripción */
  @Get('registration/:registrationId/roster-status')
  rosterStatus(@Param('registrationId', ParseUUIDPipe) registrationId: string) {
    return this.service.getRosterStatus(registrationId)
  }

  /** Financials: fines + payments for a registration */
  @Get('registration/:registrationId/financials')
  financials(@Param('registrationId', ParseUUIDPipe) registrationId: string) {
    return this.service.getFinancials(registrationId)
  }
}
