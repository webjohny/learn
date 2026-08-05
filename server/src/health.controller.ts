import { Controller, Get } from '@nestjs/common'

/** Публічна перевірка живості — використовується HEALTHCHECK у Docker. */
@Controller('api/health')
export class HealthController {
  @Get()
  check() {
    return { ok: true, uptime: Math.round(process.uptime()) }
  }
}
