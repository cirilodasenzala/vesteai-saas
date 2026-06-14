import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { ProvidersModule } from './infra/providers.module';
import { HealthModule } from './modules/health/health.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { WhatsappSenderModule } from './modules/whatsapp/whatsapp-sender.module';
import { ConversationModule } from './modules/conversation/conversation.module';
import { MemoryModule } from './modules/memory/memory.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { EventsModule } from './modules/events/events.module';
import { TryOnModule } from './modules/tryon/tryon.module';
import { WardrobeModule } from './modules/wardrobe/wardrobe.module';
import { StorageModule } from './modules/storage/storage.module';
import { QueueModule } from './queue/queue.module';
import { BillingModule } from './modules/billing/billing.module';
import { HistoryModule } from './modules/history/history.module';
import { AdminModule } from './modules/admin/admin.module';
import { ReferralModule } from './modules/referral/referral.module';
import { DevModule } from './modules/dev/dev.module';

const isProd = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    AppConfigModule,
    // Logging estruturado com pino (pretty no dev).
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport: isProd
          ? undefined
          : { target: 'pino-pretty', options: { singleLine: true } },
        // Evita logar corpos com PII por padrão.
        redact: ['req.headers.authorization', 'req.headers.apikey'],
      },
    }),
    // Rate limiting global (anti-abuso/anti-spam).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),

    PrismaModule,
    CryptoModule,
    ProvidersModule,
    WhatsappSenderModule,

    MemoryModule,
    SubscriptionModule,
    OnboardingModule,
    EventsModule,
    TryOnModule,
    WardrobeModule,
    StorageModule,
    QueueModule,
    HistoryModule,
    AdminModule,
    ReferralModule,

    HealthModule,
    ConversationModule,
    WhatsappModule,
    BillingModule,

    // Utilidades de dev (simulador de WhatsApp) só fora de produção.
    ...(isProd ? [] : [DevModule]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
