import { Injectable, Logger } from '@nestjs/common';
import {
  ConvState,
  Intent,
  Language,
  MsgDirection,
  MsgType,
} from '@vesteai/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { WhatsappSender } from '../whatsapp/whatsapp-sender.service';
import type { InboundMessage } from '../whatsapp/whatsapp.types';
import { WELCOME } from './messages';
import { SubscriptionService } from '../subscription/subscription.service';
import { MemoryService } from '../memory/memory.service';
import { OnboardingService, OnboardingContext } from '../onboarding/onboarding.service';
import { EventsService, EventContextScratch } from '../events/events.service';
import { TryOnService } from '../tryon/tryon.service';
import { WardrobeService } from '../wardrobe/wardrobe.service';
import { ReferralService } from '../referral/referral.service';
import { PaymentProvider } from '../../core/ports/payment.provider';
import { AIStylistProvider } from '../../core/ports/ai-stylist.provider';

/**
 * ConversationService — motor da máquina de estados (carregar→rotear→persistir).
 *
 * FASE 2: fluxo completo até IDLE:
 *   NEW -> (assinatura ativa? IDLE : envia link de pagamento, AWAITING_PAYMENT)
 *   AWAITING_PAYMENT -> aguarda webhook de pagamento (out-of-band)
 *   (pagamento confirmado) -> cria usuário + ONBOARDING + 1ª pergunta
 *   ONBOARDING -> step machine -> IDLE
 *   IDLE -> resposta do stylist (mock/gemini) — sub-fluxos vêm nas Fases 3/4.
 */
@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: WhatsappSender,
    private readonly subscription: SubscriptionService,
    private readonly memory: MemoryService,
    private readonly onboarding: OnboardingService,
    private readonly events: EventsService,
    private readonly tryonFlow: TryOnService,
    private readonly wardrobe: WardrobeService,
    private readonly referral: ReferralService,
    private readonly payment: PaymentProvider,
    private readonly stylist: AIStylistProvider,
  ) {}

  /** Ponto de entrada para cada mensagem recebida do webhook. */
  async handleInbound(msg: InboundMessage): Promise<void> {
    if (await this.isDuplicate(msg.waMessageId)) {
      this.logger.debug(`Mensagem duplicada ignorada: ${msg.waMessageId}`);
      return;
    }

    const conversation = await this.loadOrCreateConversation(msg.from);

    await this.persistInbound(conversation.id, conversation.userId, msg);
    await this.touch(conversation.id);

    // Detecta e atualiza o idioma sempre que houver texto e usuário.
    const lang = await this.resolveLanguage(conversation.userId, msg.text);

    switch (conversation.state) {
      case ConvState.NEW:
        return this.handleNew(conversation.id, conversation.whatsappNumber, lang);
      case ConvState.AWAITING_PAYMENT:
        return this.handleAwaitingPayment(
          conversation.id,
          conversation.whatsappNumber,
          lang,
        );
      case ConvState.ONBOARDING:
        return this.handleOnboarding(conversation, lang, msg.text ?? '');
      case ConvState.EVENT_DETAILS:
        return this.handleEventDetails(conversation, lang, msg.text ?? '');
      case ConvState.TRYON_BODY:
        return this.handleTryonBody(conversation, lang, msg);
      case ConvState.TRYON_GARMENT:
        return this.handleTryonGarment(conversation, lang, msg);
      case ConvState.TRYON_PROCESSING:
        return this.handleTryonProcessing(conversation, lang, msg);
      case ConvState.WARDROBE_INTAKE:
        return this.handleWardrobeIntake(conversation, lang, msg);
      case ConvState.IDLE:
      default:
        return this.handleIdle(conversation, lang, msg);
    }
  }

  // ---------- Estados ----------

  private async handleNew(
    conversationId: string,
    whatsappNumber: string,
    lang: Language,
  ): Promise<void> {
    await this.reply(conversationId, whatsappNumber, WELCOME[lang] ?? WELCOME[Language.PT]);

    if (await this.subscription.hasActiveSubscription(whatsappNumber)) {
      await this.setState(conversationId, ConvState.IDLE);
      return;
    }

    await this.sendPaymentLink(conversationId, whatsappNumber, lang);
    await this.setState(conversationId, ConvState.AWAITING_PAYMENT);
  }

  private async handleAwaitingPayment(
    conversationId: string,
    whatsappNumber: string,
    lang: Language,
  ): Promise<void> {
    // Pode ter pago entre mensagens — revalida.
    if (await this.subscription.hasActiveSubscription(whatsappNumber)) {
      await this.beginOnboarding(whatsappNumber);
      return;
    }
    const msg =
      lang === Language.EN
        ? 'To unlock your stylist, please complete your subscription using the link above. 💳'
        : 'Para liberar seu stylist, conclua sua assinatura pelo link acima. 💳';
    await this.reply(conversationId, whatsappNumber, msg);
    await this.sendPaymentLink(conversationId, whatsappNumber, lang);
  }

  private async handleOnboarding(
    conversation: { id: string; userId: string | null; whatsappNumber: string; context: unknown },
    lang: Language,
    text: string,
  ): Promise<void> {
    if (!conversation.userId) {
      // Inconsistência: sem usuário em ONBOARDING. Recupera.
      await this.beginOnboarding(conversation.whatsappNumber);
      return;
    }
    const ctx = (conversation.context as OnboardingContext) ?? {};
    const result = await this.onboarding.handle(
      conversation.userId,
      lang,
      text,
      ctx,
    );
    await this.reply(conversation.id, conversation.whatsappNumber, result.reply);
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        context: result.context as object,
        state: result.done ? ConvState.IDLE : ConvState.ONBOARDING,
      },
    });
  }

  private async handleIdle(
    conversation: { id: string; userId: string | null; whatsappNumber: string },
    lang: Language,
    msg: InboundMessage,
  ): Promise<void> {
    const userId = conversation.userId;

    // Mídia no IDLE: usuário mandou uma foto -> inicia o provador pedindo
    // o corpo (se a foto for a do corpo, o próximo passo é a roupa).
    if (msg.type !== MsgType.TEXT || !msg.text) {
      const start = this.tryonFlow.promptBody(lang);
      await this.reply(conversation.id, conversation.whatsappNumber, start.reply!);
      await this.setState(conversation.id, start.state);
      return;
    }

    const intent = await this.stylist.classifyIntent(msg.text);

    switch (intent) {
      case Intent.EVENT: {
        if (!userId) break;
        const r = await this.events.begin(userId, lang, msg.text);
        await this.reply(conversation.id, conversation.whatsappNumber, r.reply);
        await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            context: (r.context as object) ?? {},
            state: r.done ? ConvState.IDLE : ConvState.EVENT_DETAILS,
          },
        });
        return;
      }
      case Intent.CONSULT: {
        const snapshot = userId
          ? await this.memory.snapshot(userId)
          : { language: lang };
        const answer = await this.stylist.consultImage({
          question: msg.text,
          language: lang,
          memory: snapshot,
        });
        await this.reply(conversation.id, conversation.whatsappNumber, answer);
        return;
      }
      case Intent.SCORE: {
        const snapshot = userId
          ? await this.memory.snapshot(userId)
          : { language: lang };
        const result = await this.stylist.scoreOutfit({
          question: msg.text,
          language: lang,
          memory: snapshot,
        });
        // Persiste a nota como um Look avaliado.
        if (userId && result.score > 0) {
          await this.prisma.look.create({
            data: {
              userId,
              description: result.text,
              items: {},
              score: result.score,
              scoreReason: result.reason,
            },
          });
        }
        await this.reply(conversation.id, conversation.whatsappNumber, result.text);
        return;
      }
      case Intent.PALETTE: {
        const snapshot = userId
          ? await this.memory.snapshot(userId)
          : { language: lang };
        const palette = await this.stylist.colorPalette({
          question: msg.text,
          language: lang,
          memory: snapshot,
        });
        await this.reply(conversation.id, conversation.whatsappNumber, palette);
        return;
      }
      case Intent.REFERRAL: {
        if (!userId) break;
        const text = await this.referral.invitationMessage(userId, lang);
        await this.reply(conversation.id, conversation.whatsappNumber, text);
        return;
      }
      case Intent.TRYON: {
        const start = this.tryonFlow.promptBody(lang);
        await this.reply(conversation.id, conversation.whatsappNumber, start.reply!);
        await this.setState(conversation.id, start.state);
        return;
      }
      case Intent.WARDROBE_ADD: {
        const r = this.wardrobe.startIntake(lang);
        await this.reply(conversation.id, conversation.whatsappNumber, r.reply);
        await this.setState(conversation.id, r.state);
        return;
      }
      case Intent.WARDROBE_USE: {
        if (!userId) break;
        const text = await this.wardrobe.buildFromWardrobe(userId, lang);
        await this.reply(conversation.id, conversation.whatsappNumber, text);
        return;
      }
      default:
        break;
    }

    // CHAT (e fallbacks): resposta conversacional do stylist.
    const snapshot = userId
      ? await this.memory.snapshot(userId)
      : { language: lang };
    const reply = await this.stylist.reply({ text: msg.text, memory: snapshot });
    await this.reply(conversation.id, conversation.whatsappNumber, reply.text);
  }

  private async handleEventDetails(
    conversation: { id: string; userId: string | null; whatsappNumber: string; context: unknown },
    lang: Language,
    text: string,
  ): Promise<void> {
    if (!conversation.userId) {
      await this.setState(conversation.id, ConvState.IDLE);
      return;
    }
    const ctx = (conversation.context as { event?: EventContextScratch }) ?? {};
    const scratch = ctx.event ?? {};
    const r = await this.events.handle(conversation.userId, lang, text, scratch);
    await this.reply(conversation.id, conversation.whatsappNumber, r.reply);
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        context: (r.context as object) ?? {},
        state: r.done ? ConvState.IDLE : ConvState.EVENT_DETAILS,
      },
    });
  }

  // ---------- Sub-fluxo do provador ----------

  private async handleTryonBody(
    conversation: { id: string; userId: string | null; whatsappNumber: string },
    lang: Language,
    msg: InboundMessage,
  ): Promise<void> {
    if (!conversation.userId) {
      await this.setState(conversation.id, ConvState.IDLE);
      return;
    }
    const r = await this.tryonFlow.receiveBody(conversation.userId, lang, msg);
    if (r.reply) await this.reply(conversation.id, conversation.whatsappNumber, r.reply);
    await this.setState(conversation.id, r.state);
  }

  private async handleTryonGarment(
    conversation: { id: string; userId: string | null; whatsappNumber: string },
    lang: Language,
    msg: InboundMessage,
  ): Promise<void> {
    if (!conversation.userId) {
      await this.setState(conversation.id, ConvState.IDLE);
      return;
    }

    // Em TRYON_GARMENT a peça é uma IMAGEM. Se vier TEXTO:
    //  - "sim/outra" -> segue pedindo a próxima foto;
    //  - qualquer outra coisa -> encerra o provador e re-roteia a intenção
    //    (evita tratar "monte um look", "pronto" etc. como nova roupa).
    if (msg.type === MsgType.TEXT) {
      const t = (msg.text ?? '').trim();
      if (/^(sim|yes|outra|another|quero)$/i.test(t)) {
        const m =
          lang === Language.EN
            ? 'Great — send the next clothing photo. 👗'
            : 'Ótimo — envie a foto da próxima roupa. 👗';
        await this.reply(conversation.id, conversation.whatsappNumber, m);
        return; // permanece em TRYON_GARMENT
      }
      // Sai do provador e processa a mensagem como se estivesse no IDLE.
      await this.setState(conversation.id, ConvState.IDLE);
      await this.handleIdle(conversation, lang, msg);
      return;
    }

    // Imagem: trata como a roupa a experimentar.
    const r = await this.tryonFlow.receiveGarment(
      conversation.userId,
      conversation.id,
      conversation.whatsappNumber,
      lang,
      msg,
    );
    if (r.reply) await this.reply(conversation.id, conversation.whatsappNumber, r.reply);
    await this.setState(conversation.id, r.state);
  }

  private async handleTryonProcessing(
    conversation: { id: string; whatsappNumber: string },
    lang: Language,
    _msg: InboundMessage,
  ): Promise<void> {
    const r = this.tryonFlow.processingNotice(lang);
    if (r.reply) await this.reply(conversation.id, conversation.whatsappNumber, r.reply);
  }

  private async handleWardrobeIntake(
    conversation: { id: string; userId: string | null; whatsappNumber: string },
    lang: Language,
    msg: InboundMessage,
  ): Promise<void> {
    if (!conversation.userId) {
      await this.setState(conversation.id, ConvState.IDLE);
      return;
    }
    const r = await this.wardrobe.handleIntake(conversation.userId, lang, msg);
    await this.reply(conversation.id, conversation.whatsappNumber, r.reply);
    await this.setState(conversation.id, r.state);
  }

  // ---------- Onboarding pós-pagamento (chamado pelo billing) ----------

  /**
   * Inicia o onboarding após confirmação de pagamento. Idempotente:
   * se já passou do onboarding, não repete.
   */
  async beginOnboarding(whatsappNumber: string): Promise<void> {
    const conversation = await this.loadOrCreateConversation(whatsappNumber);
    const user = await this.memory.ensureUser(whatsappNumber);

    // Liga a conversa ao usuário, se ainda não estiver.
    if (!conversation.userId) {
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { userId: user.id },
      });
    }

    if (conversation.state === ConvState.ONBOARDING || conversation.state === ConvState.IDLE) {
      return; // já em onboarding/uso
    }

    const lang = (user.language as unknown as Language) ?? Language.PT;
    const start = this.onboarding.start(lang);
    await this.reply(conversation.id, whatsappNumber, start.reply);
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { state: ConvState.ONBOARDING, context: start.context as object },
    });
  }

  // ---------- Helpers ----------

  private async sendPaymentLink(
    conversationId: string,
    whatsappNumber: string,
    lang: Language,
  ): Promise<void> {
    try {
      const { url } = await this.payment.createCheckoutLink({ whatsappNumber });
      const msg =
        lang === Language.EN
          ? `Here’s your secure checkout to activate VesteAI Premium:\n${url}`
          : `Aqui está seu checkout seguro para ativar o VesteAI Premium:\n${url}`;
      await this.reply(conversationId, whatsappNumber, msg);
    } catch (err) {
      // Falha do gateway não deve travar a conversa — avisa com elegância.
      this.logger.error('Falha ao gerar link de pagamento.', err as Error);
      const msg =
        lang === Language.EN
          ? 'I’m setting up your secure checkout — I’ll send the payment link in a moment. 💳'
          : 'Estou preparando seu checkout seguro — te envio o link de pagamento em instantes. 💳';
      await this.reply(conversationId, whatsappNumber, msg);
    }
  }

  private async resolveLanguage(
    userId: string | null,
    text?: string,
  ): Promise<Language> {
    if (!text) {
      if (userId) {
        const u = await this.prisma.user.findUnique({ where: { id: userId } });
        return (u?.language as unknown as Language) ?? Language.PT;
      }
      return Language.PT;
    }
    const lang = await this.stylist.detectLanguage(text);
    if (userId) await this.memory.setLanguage(userId, lang);
    return lang;
  }

  private async isDuplicate(waMessageId?: string): Promise<boolean> {
    if (!waMessageId) return false;
    const existing = await this.prisma.message.findUnique({
      where: { waMessageId },
    });
    return !!existing;
  }

  private async loadOrCreateConversation(whatsappNumber: string) {
    const existing = await this.prisma.conversation.findUnique({
      where: { whatsappNumber },
    });
    if (existing) return existing;
    return this.prisma.conversation.create({
      data: { whatsappNumber, state: ConvState.NEW },
    });
  }

  private async persistInbound(
    conversationId: string,
    userId: string | null,
    msg: InboundMessage,
  ): Promise<void> {
    await this.prisma.message.create({
      data: {
        conversationId,
        userId: userId ?? undefined,
        waMessageId: msg.waMessageId,
        direction: MsgDirection.INBOUND,
        type: msg.type,
        body: msg.text ?? null,
        // Não persistimos o base64 da mídia aqui (a imagem vai p/ o storage
        // nos sub-fluxos). Marcamos só a presença de mídia.
        mediaKey: msg.mediaBase64 ? 'inbound-media' : null,
      },
    });
  }

  private async reply(
    conversationId: string,
    to: string,
    body: string,
  ): Promise<void> {
    await this.sender.sendText(to, body);
    await this.prisma.message.create({
      data: {
        conversationId,
        direction: MsgDirection.OUTBOUND,
        type: MsgType.TEXT,
        body,
      },
    });
  }

  private async touch(conversationId: string): Promise<void> {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });
  }

  private async setState(conversationId: string, state: ConvState): Promise<void> {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { state },
    });
  }
}
