import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService — cliente de banco compartilhado.
 * Conecta no boot e desconecta no shutdown do módulo.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Conectado ao banco de dados.');
    } catch (err) {
      this.logger.error(
        'Falha ao conectar no banco. Verifique DATABASE_URL e se o Postgres está no ar.',
        err as Error,
      );
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
