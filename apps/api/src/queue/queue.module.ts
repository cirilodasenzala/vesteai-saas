import { Global, Module } from '@nestjs/common';
import { TryOnProcessor } from './tryon.processor';
import { TryOnQueue } from './tryon.queue';

/**
 * QueueModule — fila do provador. StorageProvider/TryOnProvider vêm do
 * ProvidersModule (@Global); WhatsappSender do WhatsappSenderModule (@Global).
 */
@Global()
@Module({
  providers: [TryOnProcessor, TryOnQueue],
  exports: [TryOnQueue],
})
export class QueueModule {}
