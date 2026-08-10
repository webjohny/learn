import { Module } from '@nestjs/common'

import { AdminController } from './admin/admin.controller.js'
import { AdminGuard } from './admin/admin.guard.js'
import { AdminService } from './admin/admin.service.js'
import { AuthController } from './auth/auth.controller.js'
import { AuthGuard } from './auth/auth.guard.js'
import { AuthService } from './auth/auth.service.js'
import { DatabaseModule } from './database/database.module.js'
import { DecksController } from './decks/decks.controller.js'
import { DecksService } from './decks/decks.service.js'
import { HealthController } from './health.controller.js'
import { QuizController } from './quiz/quiz.controller.js'
import { QuizService } from './quiz/quiz.service.js'
import { SyncController } from './sync/sync.controller.js'
import { SyncService } from './sync/sync.service.js'

@Module({
  imports: [DatabaseModule],
  controllers: [
    HealthController,
    AuthController,
    DecksController,
    SyncController,
    QuizController,
    AdminController,
  ],
  providers: [AuthService, AuthGuard, DecksService, SyncService, QuizService, AdminService, AdminGuard],
})
export class AppModule {}
