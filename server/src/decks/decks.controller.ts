import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'

import { AuthGuard } from '../auth/auth.guard.js'
import { CurrentUser } from '../common/current-user.decorator.js'
import type { PublicUser } from '../types.js'
import { DecksService } from './decks.service.js'
import { CreateDeckDto, UpdateDeckDto } from './dto.js'

@Controller('api/decks')
@UseGuards(AuthGuard)
export class DecksController {
  constructor(private readonly decks: DecksService) {}

  @Get()
  list(@CurrentUser() user: PublicUser) {
    return { decks: this.decks.list(user.id) }
  }

  @Post()
  create(@CurrentUser() user: PublicUser, @Body() dto: CreateDeckDto) {
    return { deck: this.decks.create(user.id, dto) }
  }

  @Patch(':id')
  update(
    @CurrentUser() user: PublicUser,
    @Param('id') id: string,
    @Body() dto: UpdateDeckDto,
  ) {
    return { deck: this.decks.update(user.id, id, dto) }
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    this.decks.remove(user.id, id)
  }
}
