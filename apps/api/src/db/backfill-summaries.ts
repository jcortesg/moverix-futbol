/**
 * Regenera el post-resumen de los partidos ya finalizados.
 *
 * Usa el SERVICIO real (SocialPostsService.onMatchFinalized) en vez de
 * reimplementar el texto, para que no haya dos versiones que se desincronicen.
 * Es idempotente: sourceId = finalize_{matchId} y el post es actualizable, asi
 * que reescribe el resumen existente en vez de duplicarlo, conservando id,
 * reacciones y comentarios.
 *
 *   pnpm --filter api exec ts-node -r tsconfig-paths/register src/db/backfill-summaries.ts          (simulacion)
 *   pnpm --filter api exec ts-node -r tsconfig-paths/register src/db/backfill-summaries.ts --apply
 */
import { NestFactory } from '@nestjs/core'
import * as admin from 'firebase-admin'
import { eq } from 'drizzle-orm'
import { AppModule } from '../app.module'
import { DatabaseService } from './database.service'
import { SocialPostsService } from '../modules/social/social-posts.service'
import { matches } from './schema'

async function main() {
  const apply = process.argv.includes('--apply')

  // main.ts inicializa Firebase Admin, pero el contexto standalone no lo corre.
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID ?? 'moverix' })
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  })

  const db = app.get(DatabaseService).db
  const social = app.get(SocialPostsService)

  const finished = await db
    .select({
      id: matches.id,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
    })
    .from(matches)
    .where(eq(matches.status, 'finished'))

  console.log(`Partidos finalizados: ${finished.length}`)
  if (!apply) {
    console.log('SIMULACION — no se escribe nada. Usa --apply para ejecutar.')
    await app.close()
    return
  }

  let ok = 0
  let fail = 0
  for (const [i, m] of finished.entries()) {
    try {
      await social.onMatchFinalized(m)
      ok++
    } catch (err) {
      fail++
      console.error(`  fallo ${m.id}: ${(err as Error).message}`)
    }
    if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${finished.length}…`)
    // Pausa corta: cada partido escribe a ~120 feeds.
    await new Promise((r) => setTimeout(r, 200))
  }

  console.log(`\nListo. ok=${ok} fallidos=${fail}`)
  await app.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
