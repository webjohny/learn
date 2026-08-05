import { createParamDecorator, type ExecutionContext } from '@nestjs/common'

import type { AuthedRequest } from '../auth/auth.guard.js'
import type { PublicUser } from '../types.js'

/** Дістає користувача, якого поклав AuthGuard. Використовувати лише під @UseGuards(AuthGuard). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PublicUser => {
    const request = context.switchToHttp().getRequest<AuthedRequest>()
    return request.user!
  },
)
