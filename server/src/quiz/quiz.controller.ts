import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common'

import { AuthGuard } from '../auth/auth.guard.js'
import { CurrentUser } from '../common/current-user.decorator.js'
import type { PublicUser } from '../types.js'
import { QuizPushDto } from './dto.js'
import { QuizService } from './quiz.service.js'

/** Окремий від `/api/sync` контур: вікторини належать акаунту, не колоді. */
@Controller('api/quiz')
@UseGuards(AuthGuard)
export class QuizController {
  constructor(private readonly quiz: QuizService) {}

  @Get()
  pull(@CurrentUser() user: PublicUser, @Query('since') since?: string) {
    return this.quiz.pull(user.id, since)
  }

  @Post()
  @HttpCode(200)
  push(@CurrentUser() user: PublicUser, @Body() dto: QuizPushDto) {
    return this.quiz.push(user.id, dto)
  }
}
