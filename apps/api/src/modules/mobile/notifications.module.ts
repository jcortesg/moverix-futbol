import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../db/database.module'
import { MobileNotificationsService } from './mobile-notifications.service'

/** Módulo reutilizable: expone el servicio de notificaciones para engancharlo
 *  desde otros módulos (partidos, inscripciones, social…). */
@Module({
  imports: [DatabaseModule],
  providers: [MobileNotificationsService],
  exports: [MobileNotificationsService],
})
export class NotificationsModule {}
