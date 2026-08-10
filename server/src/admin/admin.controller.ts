import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common'

import { CurrentUser } from '../common/current-user.decorator.js'
import type { PublicUser } from '../types.js'
import { AdminGuard } from './admin.guard.js'
import { AdminService } from './admin.service.js'
import { GrantCardsDto } from './dto.js'

/** Панель власника: зведення по всіх акаунтах і передача карток користувачам. */
@Controller('api/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.overview()
  }

  @Get('users')
  users() {
    return { users: this.admin.users() }
  }

  @Get('users/:id')
  detail(@Param('id') id: string) {
    return this.admin.detail(id)
  }

  @Post('users/:id/cards')
  @HttpCode(200)
  grantCards(
    @CurrentUser() admin: PublicUser,
    @Param('id') id: string,
    @Body() dto: GrantCardsDto,
  ) {
    return this.admin.grantCards(admin.id, id, dto)
  }
}
