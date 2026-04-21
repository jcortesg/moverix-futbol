import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { TerminusModule } from '@nestjs/terminus'
import { AuthModule } from './modules/auth/auth.module'
import { LeaguesModule } from './modules/leagues/leagues.module'
import { EditionsModule } from './modules/editions/editions.module'
import { TeamsModule } from './modules/teams/teams.module'
import { RegistrationsModule } from './modules/registrations/registrations.module'
import { GroupsModule } from './modules/groups/groups.module'
import { MatchdaysModule } from './modules/matchdays/matchdays.module'
import { MatchesModule } from './modules/matches/matches.module'
import { BracketsModule } from './modules/brackets/brackets.module'
import { StandingsModule } from './modules/standings/standings.module'
import { PaymentsModule } from './modules/payments/payments.module'
import { PlayersModule } from './modules/players/players.module'
import { HealthController } from './health.controller'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    TerminusModule,
    AuthModule,
    LeaguesModule,
    EditionsModule,
    TeamsModule,
    RegistrationsModule,
    GroupsModule,
    MatchdaysModule,
    MatchesModule,
    BracketsModule,
    StandingsModule,
    PaymentsModule,
    PlayersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
