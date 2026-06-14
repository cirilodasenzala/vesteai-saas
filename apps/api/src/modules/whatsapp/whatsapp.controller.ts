import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Inject,
  Logger,
  Post,
  Query,
} from '@nestjs/common';
import type { AppConfig } from '../../config/config.module';
import { ConversationService } from '../conversation/conversation.service';
import { parseEvolutionMessages, EvolutionWebhookBody } from './whatsapp.types';

/**
 * Webhook da Evolution API.
 *  - POST /webhooks/evolution -> recebe eventos (MESSAGES_UPSERT).
 *
 * Validação opcional: se EVOLUTION_WEBHOOK_TOKEN estiver definido, exige
 * o mesmo valor no header `apikey` ou na query `?token=`. Sem token
 * configurado, aceita (útil em dev / rede interna do EasyPanel).
 */
@Controller('webhooks/evolution')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    @Inject('APP_CONFIG') private readonly config: AppConfig,
    private readonly conversation: ConversationService,
  ) {}

  @Post()
  @HttpCode(200)
  async receive(
    @Headers('apikey') apikey: string | undefined,
    @Query('token') token: string | undefined,
    @Body() body: EvolutionWebhookBody,
  ): Promise<{ received: true }> {
    const expected = this.config.EVOLUTION_WEBHOOK_TOKEN;
    if (expected && apikey !== expected && token !== expected) {
      this.logger.warn('Webhook Evolution rejeitado (token inválido).');
      throw new ForbiddenException('Token inválido.');
    }

    const messages = parseEvolutionMessages(body);
    for (const msg of messages) {
      try {
        await this.conversation.handleInbound(msg);
      } catch (err) {
        this.logger.error(
          `Falha ao processar mensagem ${msg.waMessageId}`,
          err as Error,
        );
      }
    }

    // Responde 200 rápido para a Evolution não reenfileirar.
    return { received: true };
  }
}
