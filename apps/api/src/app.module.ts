import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { TerminusModule } from '@nestjs/terminus'
import { FirebaseAuthGuard } from './common/guards/firebase-auth.guard'
import { AuthModule } from './modules/auth/auth.module'
import { LeaguesModule } from './modules/leagues/leagues.module'
import { EditionsModule } from './modules/editions/editions.module'
import { TeamsModule } from './modules/teams/teams.module'
import { RegistrationsModule } from './modules/registrations/registrations.module'
import { RegistrationPlayersModule } from './modules/registration-players/registration-players.module'
import { GroupsModule } from './modules/groups/groups.module'
import { MatchdaysModule } from './modules/matchdays/matchdays.module'
import { MatchesModule } from './modules/matches/matches.module'
import { MatchEventsModule } from './modules/match-events/match-events.module'
import { MatchDelegatesModule } from './modules/match-delegates/match-delegates.module'
import { BracketsModule } from './modules/brackets/brackets.module'
import { StandingsModule } from './modules/standings/standings.module'
import { PaymentsModule } from './modules/payments/payments.module'
import { FinesModule } from './modules/fines/fines.module'
import { PlayersModule } from './modules/players/players.module'
import { PlayerStatsModule } from './modules/player-stats/player-stats.module'
import { OrganizationsModule } from './modules/organizations/organizations.module'
import { VenuesModule } from './modules/venues/venues.module'
import { RefereesModule } from './modules/referees/referees.module'
import { PlayersAdminModule } from './modules/players-admin/players-admin.module'
import { MobileModule } from './modules/mobile/mobile.module'
import { PublicModule } from './modules/public/public.module'
import { SocialModule } from './modules/social/social.module'
import { DatabaseModule } from './db/database.module'
import { FirestoreModule } from './common/services/firestore.module'
import { HealthController } from './health.controller'
import { UploadsController } from './common/controllers/uploads.controller'
import { StorageService } from './common/services/storage.service'
import { UserAuthMiddleware } from './common/middleware/user-auth.middleware'
import { ActorContextMiddleware } from './common/middleware/actor-context.middleware'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    FirestoreModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    TerminusModule,
    AuthModule,
    OrganizationsModule,
    VenuesModule,
    RefereesModule,
    PlayersAdminModule,
    LeaguesModule,
    EditionsModule,
    TeamsModule,
    RegistrationsModule,
    RegistrationPlayersModule,
    GroupsModule,
    MatchdaysModule,
    MatchesModule,
    MatchEventsModule,
    MatchDelegatesModule,
    BracketsModule,
    StandingsModule,
    PaymentsModule,
    FinesModule,
    PlayersModule,
    PlayerStatsModule,
    MobileModule,
    PublicModule,
    SocialModule,
  ],
  controllers: [HealthController, UploadsController],
  providers: [
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
    StorageService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ActorContextMiddleware, UserAuthMiddleware).forRoutes('*')
  }
}
