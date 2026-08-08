import 'reflect-metadata'

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import cookieParser from 'cookie-parser'
import type { Express, Request, Response } from 'express'

import { AppModule } from './app.module.js'
import { withCode } from './common/error-codes.js'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  const port = Number(process.env.PORT ?? 8787)

  app.use(cookieParser())
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // Клієнт очікує одне повідомлення, а не масив. Разом із текстом віддаємо
      // код виду `validation.<поле>.<правило>` — його клієнт перекладає сам,
      // тож DTO лишаються без змін.
      exceptionFactory: (errors) => {
        const first = errors[0]
        const constraint = first?.constraints ? Object.keys(first.constraints)[0] : undefined
        const message = first?.constraints
          ? Object.values(first.constraints)[0]
          : 'Некоректні дані запиту.'
        const code = constraint ? `validation.${first.property}.${constraint}` : 'validation.unknown'
        return new BadRequestException(withCode(message, code))
      },
    }),
  )

  // У проді той самий процес роздає зібраний фронтенд і віддає index.html
  // на будь-який не-API маршрут, щоб працював client-side routing.
  const dist = resolve(process.cwd(), 'dist')
  if (existsSync(dist)) {
    app.useStaticAssets(dist)
    const server = app.getHttpAdapter().getInstance() as Express
    server.get(/^(?!\/api).*/, (_req: Request, res: Response) =>
      res.sendFile(resolve(dist, 'index.html')),
    )
  }

  await app.listen(port)
  new Logger('Bootstrap').log(`Phrase Deck API слухає http://localhost:${port}`)
}

void bootstrap()
