import { Module } from '@nestjs/common';
import { TryOnService } from './tryon.service';

/**
 * TryOnModule — sub-fluxo do provador. StorageProvider e TryOnQueue vêm de
 * módulos @Global (ProvidersModule, QueueModule); WhatsappSender vem do
 * WhatsappSenderModule (@Global).
 */
@Module({
  providers: [TryOnService],
  exports: [TryOnService],
})
export class TryOnModule {}
