import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import * as admin from 'firebase-admin'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest()
    const token = this.extractToken(request)

    if (!token) throw new UnauthorizedException('Token requerido')

    try {
      const decoded = await admin.auth().verifyIdToken(token)
      request.user = decoded
      console.log(`[AUTH] uid=${decoded.uid} email=${decoded.email}`)
      return true
    } catch {
      throw new UnauthorizedException('Token inválido o expirado')
    }
  }

  private extractToken(request: { headers: { authorization?: string } }): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? []
    return type === 'Bearer' ? token : null
  }
}
