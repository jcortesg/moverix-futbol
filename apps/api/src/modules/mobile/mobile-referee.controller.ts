import { Body, Controller, Get, Param, Put, Req } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { MobileRefereeService } from './mobile-referee.service'

@ApiTags('mobile')
@ApiBearerAuth()
@Controller('mobile/referee')
export class MobileRefereeController {
  constructor(private readonly service: MobileRefereeService) {}

  /** Partidos que me asignaron para dirigir */
  @Get('matches')
  myMatches(@Req() req: any) {
    return this.service.myMatches(req.user.uid)
  }

  /** Detalle del partido para dirigir (nóminas + asistencia + estado) */
  @Get('matches/:id')
  matchDetail(@Req() req: any, @Param('id') id: string) {
    return this.service.matchDetail(req.user.uid, id)
  }

  /** Check-in de asistencia de un jugador */
  @Put('matches/:id/attendance')
  setAttendance(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: { playerUid: string; teamId: string; present: boolean },
  ) {
    return this.service.setAttendance(req.user.uid, id, dto)
  }
}
