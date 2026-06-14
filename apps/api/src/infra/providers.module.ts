import { Global, Module, Logger } from '@nestjs/common';
import type { AppConfig } from '../config/config.module';

import { PaymentProvider } from '../core/ports/payment.provider';
import { AIStylistProvider } from '../core/ports/ai-stylist.provider';
import { StorageProvider } from '../core/ports/storage.provider';
import { TryOnProvider } from '../core/ports/tryon.provider';

import { SimulatedPaymentProvider } from './payment/simulated/simulated-payment.provider';
import { StripePaymentProvider } from './payment/stripe/stripe-payment.provider';
import { MockStylistProvider } from './ai/mock/mock-stylist.provider';
import { GeminiStylistProvider } from './ai/gemini/gemini-stylist.provider';
import { LocalStorageProvider } from './storage/local/local-storage.provider';
import { S3StorageProvider } from './storage/s3/s3-storage.provider';
import { SimulatedTryOnProvider } from './tryon/simulated/simulated-tryon.provider';
import { FashnTryOnProvider } from './tryon/fashn/fashn-tryon.provider';

/**
 * Composition root (fronteira DIP): decide, via env, qual implementação
 * concreta atende cada porta. As features dependem só das abstract classes.
 *
 *  - PaymentProvider  -> Stripe se STRIPE_SECRET_KEY, senão Simulado.
 *  - AIStylistProvider-> Gemini se AI_DRIVER=gemini + GEMINI_API_KEY, senão Mock.
 *
 * Storage e TryOn entram aqui nas Fases 4.
 */
@Global()
@Module({
  providers: [
    {
      provide: PaymentProvider,
      useFactory: (config: AppConfig): PaymentProvider => {
        const log = new Logger('ProvidersModule');
        if (config.STRIPE_SECRET_KEY) {
          log.log('PaymentProvider = Stripe (real)');
          return new StripePaymentProvider(config);
        }
        log.log('PaymentProvider = Simulado');
        return new SimulatedPaymentProvider(config);
      },
      inject: ['APP_CONFIG'],
    },
    {
      provide: AIStylistProvider,
      useFactory: (config: AppConfig): AIStylistProvider => {
        const log = new Logger('ProvidersModule');
        const hasCredential =
          !!config.GEMINI_API_KEY || !!config.GOOGLE_CREDENTIALS_JSON;
        if (config.AI_DRIVER === 'gemini' && hasCredential) {
          log.log('AIStylistProvider = Gemini (real)');
          return new GeminiStylistProvider(config);
        }
        log.log('AIStylistProvider = Mock');
        return new MockStylistProvider();
      },
      inject: ['APP_CONFIG'],
    },
    {
      provide: StorageProvider,
      useFactory: (config: AppConfig): StorageProvider => {
        const log = new Logger('ProvidersModule');
        if (config.STORAGE_DRIVER === 's3') {
          log.log('StorageProvider = S3/MinIO');
          return new S3StorageProvider(config);
        }
        log.log('StorageProvider = Local (./.storage)');
        return new LocalStorageProvider(config);
      },
      inject: ['APP_CONFIG'],
    },
    {
      provide: TryOnProvider,
      useFactory: (config: AppConfig): TryOnProvider => {
        const log = new Logger('ProvidersModule');
        if (config.FASHN_API_KEY) {
          log.log('TryOnProvider = FASHN (real)');
          return new FashnTryOnProvider(config);
        }
        log.log('TryOnProvider = Simulado');
        return new SimulatedTryOnProvider();
      },
      inject: ['APP_CONFIG'],
    },
  ],
  exports: [PaymentProvider, AIStylistProvider, StorageProvider, TryOnProvider],
})
export class ProvidersModule {}
