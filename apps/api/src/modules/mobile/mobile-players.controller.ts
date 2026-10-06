import {
  Body, Controller, Delete, Get, Param, Patch, Post, Req,
  UploadedFile, UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger'
import { MobilePlayersService } from './mobile-players.service'

@ApiTags('mobile')
@ApiBearerAuth()
@Controller('mobile/players')
export class MobilePlayersController {
  constructor(private readonly service: MobilePlayersService) {}

  // ── "me" routes first (before :uid catches "me") ──

  /** Get or create my profile */
  @Get('me/profile')
  myProfile(@Req() req: any) {
    return this.service.myProfile(req.user.uid, req.user.email, req.user.name)
  }

  /** Update my profile */
  @Patch('me/profile')
  updateMyProfile(@Req() req: any, @Body() dto: any) {
    return this.service.updateProfile(req.user.uid, dto)
  }

  /** Inscripciones en borrador con datos requeridos pendientes del jugador */
  @Get('me/pending-data')
  myPendingData(@Req() req: any) {
    return this.service.myPendingData(req.user.uid)
  }

  /** Partido en vivo o próximo por cada equipo del usuario (tarjeta del inicio) */
  @Get('me/upcoming')
  myUpcoming(@Req() req: any) {
    return this.service.myUpcomingMatches(req.user.uid)
  }

  /** Upload avatar photo */
  @Post('me/avatar')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadAvatar(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    return this.service.uploadAvatar(req.user.uid, file)
  }

  /** Deactivate my account (soft delete) */
  @Post('me/deactivate')
  deactivateAccount(@Req() req: any) {
    return this.service.deactivateAccount(req.user.uid)
  }

  /** Permanently delete my account and personal data */
  @Delete('me')
  deleteAccount(@Req() req: any) {
    return this.service.deleteAccount(req.user.uid)
  }

  // ── Parametric routes ──

  /** Public player profile */
  @Get(':uid')
  profile(@Param('uid') uid: string, @Req() req: any) {
    return this.service.profile(uid, req.user?.uid)
  }

  /** Get followers list */
  @Get(':uid/followers')
  followers(@Param('uid') uid: string) {
    return this.service.getFollowers(uid)
  }

  /** Get following list */
  @Get(':uid/following')
  following(@Param('uid') uid: string) {
    return this.service.getFollowing(uid)
  }

  /** Follow a player */
  @Post(':uid/follow')
  follow(@Req() req: any, @Param('uid') uid: string) {
    return this.service.follow(req.user.uid, uid)
  }

  /** Unfollow a player */
  @Delete(':uid/follow')
  unfollow(@Req() req: any, @Param('uid') uid: string) {
    return this.service.unfollow(req.user.uid, uid)
  }
}
