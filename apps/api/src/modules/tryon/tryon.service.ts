import { Injectable, Logger } from '@nestjs/common';
import { ConvState, Language } from '@vesteai/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageProvider } from '../../core/ports/storage.provider';
import { WhatsappSender } from '../whatsapp/whatsapp-sender.service';
import { TryOnQueue } from '../../queue/tryon.queue';
import { validateImage } from '../../common/pipes/image-validation';
import type { InboundMessage } from '../whatsapp/whatsapp.types';

/**
 * TryOnService — sub-fluxo do provador virtual.
 *   TRYON_BODY    : pede e recebe a foto do corpo inteiro -> Photo(BODY)
 *   TRYON_GARMENT : pede e recebe a roupa -> Photo(GARMENT) -> enfileira job
 *   TRYON_PROCESSING: aguarda (a fila entrega a imagem de volta)
 *
 * Retorna o novo estado a persistir. O download da mídia usa o Graph API;
 * em dev/simulado (sem token) aceita-se um placeholder para exercitar o fluxo.
 */

export interface TryOnStepResult {
  reply?: string;
  state: ConvState;
}

@Injectable()
export class TryOnService {
  private readonly logger = new Logger(TryOnService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageProvider,
    private readonly sender: WhatsappSender,
    private readonly queue: TryOnQueue,
  ) {}

  /** Mensagem pedindo a foto do corpo (entra no sub-fluxo). */
  promptBody(lang: Language): TryOnStepResult {
    return {
      reply:
        lang === Language.EN
          ? 'Let’s try it on! 📸 Send me a full-length photo of you, please.'
          : 'Vamos experimentar! 📸 Me envie uma foto sua de corpo inteiro, por favor.',
      state: ConvState.TRYON_BODY,
    };
  }

  /** Recebe a foto do corpo no estado TRYON_BODY. */
  async receiveBody(
    userId: string,
    lang: Language,
    msg: InboundMessage,
  ): Promise<TryOnStepResult> {
    const key = await this.storeIncomingImage(userId, 'BODY', msg);
    if (!key) return this.askResend(lang, ConvState.TRYON_BODY, 'corpo');

    // Guarda a chave do corpo no contexto via Photo (recuperada depois).
    return {
      reply:
        lang === Language.EN
          ? 'Perfect! Now send the clothing item (photo, print, link or on-model). 👗'
          : 'Perfeito! Agora envie a roupa (foto, print, link ou em modelo). 👗',
      state: ConvState.TRYON_GARMENT,
    };
  }

  /** Recebe a roupa no estado TRYON_GARMENT e enfileira o job. */
  async receiveGarment(
    userId: string,
    conversationId: string,
    whatsappNumber: string,
    lang: Language,
    msg: InboundMessage,
  ): Promise<TryOnStepResult> {
    const garmentKey = await this.storeIncomingImage(userId, 'GARMENT', msg);
    if (!garmentKey) return this.askResend(lang, ConvState.TRYON_GARMENT, 'roupa');

    const bodyKey = await this.latestPhotoKey(userId, 'BODY');
    if (!bodyKey) {
      // Perdeu a foto do corpo — recomeça.
      return this.promptBody(lang);
    }

    const job = await this.prisma.tryOnJob.create({
      data: { userId, bodyPhotoKey: bodyKey, garmentPhotoKey: garmentKey },
    });

    await this.queue.enqueue({
      tryOnJobId: job.id,
      userId,
      whatsappNumber,
      conversationId,
      bodyKey,
      garmentKey,
    });

    return {
      reply:
        lang === Language.EN
          ? 'On it! ✨ I’m preparing your look — one moment...'
          : 'Já estou preparando o seu look ✨ Um instante...',
      state: ConvState.TRYON_PROCESSING,
    };
  }

  /** Mensagem chegando durante o processamento. */
  processingNotice(lang: Language): TryOnStepResult {
    return {
      reply:
        lang === Language.EN
          ? 'Still working on your look — I’ll send it as soon as it’s ready! ⏳'
          : 'Ainda estou montando seu look — te envio assim que ficar pronto! ⏳',
      state: ConvState.TRYON_PROCESSING,
    };
  }

  // ---------- Helpers ----------

  /**
   * Salva uma imagem recebida no storage. A mídia chega em base64 no
   * webhook da Evolution (msg.mediaBase64); validamos os magic bytes.
   * Em dev/simulado (sem base64) grava um placeholder mínimo para
   * permitir o teste do fluxo ponta a ponta.
   */
  private async storeIncomingImage(
    userId: string,
    kind: 'BODY' | 'GARMENT',
    msg: InboundMessage,
  ): Promise<string | null> {
    let buffer: Buffer | null = null;
    let mime = 'image/jpeg';

    if (msg.mediaBase64) {
      const media = this.sender.decodeMedia(msg.mediaBase64);
      if (media) {
        const check = validateImage(media.buffer);
        if (!check.ok) {
          this.logger.warn(`Imagem inválida (${check.reason}) de ${userId}`);
          return null;
        }
        buffer = media.buffer;
        mime = check.mime ?? media.mime;
      }
    }

    // Dev/simulado: sem download real, usa placeholder mínimo (JPEG 1x1).
    if (!buffer) {
      buffer = PLACEHOLDER_JPEG;
      mime = 'image/jpeg';
    }

    const key = `users/${userId}/${kind.toLowerCase()}/${Date.now()}.jpg`;
    const stored = await this.storage.put(key, buffer, mime);
    await this.prisma.photo.create({
      data: { userId, kind, storageKey: stored.key },
    });
    return stored.key;
  }

  private async latestPhotoKey(
    userId: string,
    kind: 'BODY' | 'GARMENT',
  ): Promise<string | null> {
    const photo = await this.prisma.photo.findFirst({
      where: { userId, kind },
      orderBy: { createdAt: 'desc' },
    });
    return photo?.storageKey ?? null;
  }

  private askResend(
    lang: Language,
    state: ConvState,
    what: string,
  ): TryOnStepResult {
    return {
      reply:
        lang === Language.EN
          ? `Hmm, I couldn’t read that image. Could you resend the ${what} photo?`
          : `Hmm, não consegui ler essa imagem. Pode reenviar a foto da ${what}?`,
      state,
    };
  }
}

/** JPEG mínimo válido (placeholder para dev/simulado). */
const PLACEHOLDER_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACv/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AfwA//9k=',
  'base64',
);
