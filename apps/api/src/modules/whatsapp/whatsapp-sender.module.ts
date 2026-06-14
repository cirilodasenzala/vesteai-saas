import { Global, Module } from '@nestjs/common';
import { WhatsappSender } from './whatsapp-sender.service';

/**
 * WhatsappSenderModule — provê APENAS o WhatsappSender (envio/baixa de mídia),
 * sem o controller do webhook. Isolado para quebrar o ciclo:
 *   ConversationModule -> TryOn/Wardrobe/Queue -> (precisa do sender)
 * Sem isto, importar o WhatsappModule inteiro criaria circularidade com
 * ConversationModule (que o WhatsappModule referencia via forwardRef).
 *
 * @Global para que qualquer módulo injete o sender sem importar este módulo.
 */
@Global()
@Module({
  providers: [WhatsappSender],
  exports: [WhatsappSender],
})
export class WhatsappSenderModule {}
