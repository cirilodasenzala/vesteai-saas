import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { ConversationModule } from '../conversation/conversation.module';

/**
 * BillingModule — webhook Stripe + /dev/pay simulado.
 * Usa ConversationService para iniciar o onboarding pós-pagamento.
 */
@Module({
  imports: [ConversationModule],
  controllers: [BillingController],
})
export class BillingModule {}
