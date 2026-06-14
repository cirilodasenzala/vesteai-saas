import {
  Body,
  Controller,
  Inject,
  NotFoundException,
  Post,
} from '@nestjs/common';
import type { AppConfig } from '../../config/config.module';
import { ConversationService } from '../conversation/conversation.service';
import { MsgType } from '@vesteai/shared';
import type { InboundMessage } from '../whatsapp/whatsapp.types';

interface SimulateDto {
  from: string;
  text?: string;
  type?: 'TEXT' | 'IMAGE';
  /** base64 da imagem (opcional; sem ele os sub-fluxos usam placeholder). */
  mediaBase64?: string;
  profileName?: string;
}

/**
 * Controller SÓ DE DEV (bloqueado fora de development).
 * Permite injetar uma mensagem inbound sem passar pela Evolution —
 * útil para testar toda a máquina de conversa via curl.
 *
 *   POST /dev/wa/inbound { "from": "5511999999999", "text": "oi" }
 */
@Controller('dev/wa')
export class DevController {
  constructor(
    @Inject('APP_CONFIG') private readonly config: AppConfig,
    private readonly conversation: ConversationService,
  ) {}

  @Post('inbound')
  async inbound(@Body() dto: SimulateDto): Promise<{ ok: true }> {
    if (this.config.NODE_ENV === 'production') {
      throw new NotFoundException();
    }

    const msg: InboundMessage = {
      waMessageId: `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      from: dto.from,
      type: dto.type === 'IMAGE' ? MsgType.IMAGE : MsgType.TEXT,
      text: dto.text,
      mediaBase64: dto.mediaBase64,
      timestamp: Date.now(),
      profileName: dto.profileName,
    };

    await this.conversation.handleInbound(msg);
    return { ok: true };
  }
}
