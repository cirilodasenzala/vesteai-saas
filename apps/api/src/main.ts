import 'reflect-metadata';
import './load-env'; // DEVE vir antes do AppModule (popula process.env)
import { join } from 'path';
import { existsSync } from 'fs';
import * as express from 'express';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Captura o corpo bruto p/ verificação de assinatura (WhatsApp/Stripe).
    rawBody: true,
    bufferLogs: true,
  });

  // Fotos em base64 (Evolution) chegam grandes — sobe o limite do body
  // (mantém o rawBody do Nest, só aumenta o tamanho aceito).
  app.useBodyParser('json', { limit: '25mb' });
  app.useBodyParser('urlencoded', { limit: '25mb', extended: true });

  app.useLogger(app.get(Logger));

  // Painel admin estático em /admin-ui (HTML + JS que consome a API).
  // Resolve relativo ao dist (dist/main.js -> ../public) e ao cwd (dev).
  const adminStatic = existsSync(join(__dirname, '..', 'public', 'admin'))
    ? join(__dirname, '..', 'public', 'admin')
    : join(process.cwd(), 'public', 'admin');
  app.use('/admin-ui', express.static(adminStatic));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  const log = app.get(Logger);
  log.log(`VesteAI API rodando em http://localhost:${port}`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Falha ao iniciar a aplicação:', err);
  process.exit(1);
});
