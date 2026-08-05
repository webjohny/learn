import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import type { Request } from 'express'

import type { PublicUser } from '../types.js'
import { AuthService } from './auth.service.js'

export const SESSION_COOKIE = 'pd_session'

export interface AuthedRequest extends Request {
  user?: PublicUser
}

/** Пускає далі лише за валідною сесійною cookie. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>()
    const user = this.auth.userFromToken(request.cookies?.[SESSION_COOKIE])

    if (!user) throw new UnauthorizedException('Потрібна авторизація.')

    request.user = user
    return true
  }
}
