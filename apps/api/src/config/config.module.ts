import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { validateEnv, Env } from './env.validation';

/**
 * Wrapper tipado em volta do @nestjs/config.
 * Exporta um AppConfig (objeto validado pelo zod sobre process.env).
 *
 * O .env vive na raiz do monorepo. Apontamos vários caminhos para
 * funcionar tanto rodando da raiz quanto de apps/api (ex.: jest).
 */
export type AppConfig = Env;

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [
        '.env',
        join(process.cwd(), '.env'),
        join(process.cwd(), '..', '..', '.env'),
      ],
      // Valida sobre o process.env já mesclado com o envFile.
      validate: () => validateEnv(process.env as Record<string, unknown>),
    }),
  ],
  providers: [
    {
      provide: 'APP_CONFIG',
      useFactory: (config: ConfigService): AppConfig =>
        // Reconstrói o objeto validado a partir do ConfigService.
        validateEnv(process.env as Record<string, unknown>),
      inject: [ConfigService],
    },
  ],
  exports: ['APP_CONFIG'],
})
export class AppConfigModule {}
