import { Module } from '@nestjs/common'

import { AuthController } from './auth/auth.controller.js'
import { AuthGuard } from './auth/auth.guard.js'
import { AuthService } from './auth/auth.service.js'
import { DatabaseModule } from './database/database.module.js'
import { DecksController } from './decks/decks.controller.js'
import { DecksService } from './decks/decks.service.js'
import { HealthController } from './health.controller.js'
import { SyncController } from './sync/sync.controller.js'
import { SyncService } from './sync/sync.service.js'

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController, AuthController, DecksController, SyncController],
  providers: [AuthService, AuthGuard, DecksService, SyncService],
})
export class AppModule {}
