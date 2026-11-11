import { Injectable, NestMiddleware } from '@nestjs/common'
import type { Request, Response, NextFunction } from 'express'
import { actorContext } from '../context/actor-context'

/** Abre un contexto por request; FirebaseAuthGuard le pone uid/email. */
@Injectable()
export class ActorContextMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction) {
    actorContext.run({}, () => next())
  }
}
