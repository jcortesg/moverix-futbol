import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'

/**
 * Proxy envía el GCP identity token en Authorization (para Cloud Run IAM)
 * y el token del usuario en X-User-Authorization.
 * Este middleware restaura el token del usuario antes de llegar a los guards.
 */
@Injectable()
export class UserAuthMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const userAuth = req.headers['x-user-authorization']
    if (userAuth) {
      req.headers['authorization'] = userAuth as string
      delete req.headers['x-user-authorization']
    }
    next()
  }
}
