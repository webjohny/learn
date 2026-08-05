import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common'

import { AuthGuard } from '../auth/auth.guard.js'
import { CurrentUser } from '../common/current-user.decorator.js'
import type { PublicUser } from '../types.js'
import { SyncPushDto } from './dto.js'
import { SyncService } from './sync.service.js'

@Controller('api/sync')
@UseGuards(AuthGuard)
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Get(':deckId')
  pull(
    @CurrentUser() user: PublicUser,
    @Param('deckId') deckId: string,
    @Query('since') since?: string,
  ) {
    return this.sync.pull(user.id, deckId, since)
  }

  @Post(':deckId')
  @HttpCode(200)
  push(
    @CurrentUser() user: PublicUser,
    @Param('deckId') deckId: string,
    @Body() dto: SyncPushDto,
  ) {
    return this.sync.push(user.id, deckId, dto)
  }
}
