import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import { AuthService } from '../auth/auth.service.js'
import { SESSION_COOKIE, type AuthedRequest } from '../auth/auth.guard.js'
import { ERROR_CODES, withCode } from '../common/error-codes.js'

/**
 * Як `AuthGuard`, але додатково вимагає адмінську пошту. Окремий guard, а не
 * прапорець у `AuthGuard`: так неможливо забути обмеження на новому ендпоінті —
 * контролер адмінки просто не має іншого способу дістати користувача.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthedRequest>()
    const user = this.auth.userFromToken(request.cookies?.[SESSION_COOKIE])

    if (!user) {
      throw new UnauthorizedException(withCode('Потрібна авторизація.', ERROR_CODES.authRequired))
    }
    if (!user.isAdmin) {
      throw new ForbiddenException(
        withCode('Доступ лише для адміністратора.', ERROR_CODES.adminForbidden),
      )
    }

    request.user = user
    return true
  }
}
