import { Body, Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { MobileNotificationsService } from './mobile-notifications.service'

@ApiTags('mobile')
@ApiBearerAuth()
@Controller('mobile/notifications')
export class MobileNotificationsController {
  constructor(private readonly service: MobileNotificationsService) {}

  /** Mis notificaciones */
  @Get()
  list(@Req() req: any, @Query('limit') limit?: string) {
    return this.service.list(req.user.uid, limit ? parseInt(limit, 10) : 50)
  }

  /** Contador de no leídas (para el badge) */
  @Get('unread-count')
  unread(@Req() req: any) {
    return this.service.unreadCount(req.user.uid)
  }

  /** Registrar token de push del dispositivo */
  @Post('push-token')
  registerToken(@Req() req: any, @Body() dto: { token: string; platform?: string }) {
    return this.service.registerToken(req.user.uid, dto.token, dto.platform)
  }

  /** Quitar token (logout) */
  @Delete('push-token')
  removeToken(@Req() req: any, @Body() dto: { token: string }) {
    return this.service.removeToken(req.user.uid, dto.token)
  }

  /** Difusión a los jugadores de una edición (o grupo) — solo admin del campeonato */
  @Post('broadcast')
  broadcast(
    @Req() req: any,
    @Body() dto: {
      editionId: string
      title: string
      body: string
      groupId?: string
      data?: Record<string, string>
    },
  ) {
    return this.service.broadcastToEdition(
      req.user.uid,
      dto.editionId,
      { type: 'edition', title: dto.title, body: dto.body, data: dto.data },
      { groupId: dto.groupId },
    )
  }

  /** Marcar todas como leídas */
  @Post('read-all')
  readAll(@Req() req: any) {
    return this.service.markAllRead(req.user.uid)
  }

  /** Marcar una como leída */
  @Post(':id/read')
  read(@Req() req: any, @Param('id') id: string) {
    return this.service.markRead(req.user.uid, id)
  }
}
