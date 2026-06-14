import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappSenderModule } from './whatsapp-sender.module';
import { ConversationModule } from '../conversation/conversation.module';

/**
 * WhatsappModule — webhook (controller). O WhatsappSender vem do
 * WhatsappSenderModule (@Global). ConversationModule não depende mais de
 * WhatsappModule, então o import é direto (sem forwardRef).
 */
@Module({
  imports: [WhatsappSenderModule, ConversationModule],
  controllers: [WhatsappController],
})
export class WhatsappModule {}
