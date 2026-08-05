import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { Request, Response } from 'express'

import { CurrentUser } from '../common/current-user.decorator.js'
import { DecksService } from '../decks/decks.service.js'
import type { PublicUser } from '../types.js'
import { AuthGuard, SESSION_COOKIE } from './auth.guard.js'
import { AuthService, type Session } from './auth.service.js'
import { LoginDto, RegisterDto } from './dto.js'

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly decks: DecksService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.register(dto)
    this.setCookie(res, this.auth.createSession(user.id))
    return { user, decks: this.decks.list(user.id) }
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.login(dto)
    this.setCookie(res, this.auth.createSession(user.id))
    return { user, decks: this.decks.list(user.id) }
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[SESSION_COOKIE]
    if (token) this.auth.destroySession(token)
    res.clearCookie(SESSION_COOKIE, { path: '/' })
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: PublicUser) {
    return { user, decks: this.decks.list(user.id) }
  }

  private setCookie(res: Response, { token, expiresAt }: Session) {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      expires: expiresAt,
      path: '/',
    })
  }
}
