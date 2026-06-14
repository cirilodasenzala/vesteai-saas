import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { EventsModule } from '../events/events.module';
import { TryOnModule } from '../tryon/tryon.module';
import { WardrobeModule } from '../wardrobe/wardrobe.module';

/**
 * ConversationModule — motor de conversa. WhatsappSender vem do
 * WhatsappSenderModule (@Global); SubscriptionService, MemoryService,
 * PaymentProvider e AIStylistProvider de outros módulos @Global. Por isso
 * não há mais ciclo com WhatsappModule.
 */
@Module({
  imports: [OnboardingModule, EventsModule, TryOnModule, WardrobeModule],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
