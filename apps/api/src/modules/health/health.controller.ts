import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * /health — checagem de liveness/readiness.
 * Verifica conectividade com o banco (db). Redis/storage podem ser
 * adicionados conforme os módulos das próximas fases entrarem.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.checkDatabase()]);
  }

  private async checkDatabase(): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { database: { status: 'up' } };
    } catch (err) {
      return {
        database: { status: 'down', message: (err as Error).message },
      };
    }
  }
}
