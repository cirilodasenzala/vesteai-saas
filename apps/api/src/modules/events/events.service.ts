import { Injectable } from '@nestjs/common';
import { EventType, Language } from '@vesteai/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { MemoryService } from '../memory/memory.service';
import { AIStylistProvider } from '../../core/ports/ai-stylist.provider';
import { detectEventType, eventNeedsDetails } from './event-detect';

/**
 * EventsService — sub-fluxo de recomendação por ocasião.
 *
 * Quando o evento pede detalhes, coleta horário/local/clima em sequência
 * (estado em Conversation.context.event). Ao ter o suficiente, chama o
 * stylist para montar o look e persiste Event + Look + History.
 */

export interface EventContextScratch {
  type?: EventType;
  whenText?: string;
  place?: string;
  weather?: string;
  step?: 'when' | 'place' | 'weather' | 'ready';
}

export interface EventStepResult {
  reply: string;
  context: { event?: EventContextScratch };
  /** true quando o look foi entregue (caller volta para IDLE). */
  done: boolean;
}

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memory: MemoryService,
    private readonly stylist: AIStylistProvider,
  ) {}

  /**
   * Inicia o fluxo a partir da 1ª mensagem ("tenho um casamento").
   * Se o evento não pede detalhes, já entrega o look.
   */
  async begin(
    userId: string,
    lang: Language,
    text: string,
  ): Promise<EventStepResult> {
    const type = detectEventType(text);

    if (!eventNeedsDetails(type)) {
      return this.buildAndDeliver(userId, lang, { type, step: 'ready' });
    }

    return {
      reply: this.askWhen(lang),
      context: { event: { type, step: 'when' } },
      done: false,
    };
  }

  /** Continua o slot-filling com a próxima resposta do usuário. */
  async handle(
    userId: string,
    lang: Language,
    text: string,
    scratch: EventContextScratch,
  ): Promise<EventStepResult> {
    const answer = (text ?? '').trim();
    const s: EventContextScratch = { ...scratch };

    switch (s.step) {
      case 'when':
        s.whenText = answer;
        s.step = 'place';
        return { reply: this.askPlace(lang), context: { event: s }, done: false };
      case 'place':
        s.place = answer;
        s.step = 'weather';
        return { reply: this.askWeather(lang), context: { event: s }, done: false };
      case 'weather':
        s.weather = answer;
        s.step = 'ready';
        return this.buildAndDeliver(userId, lang, s);
      default:
        return this.buildAndDeliver(userId, lang, s);
    }
  }

  private async buildAndDeliver(
    userId: string,
    lang: Language,
    s: EventContextScratch,
  ): Promise<EventStepResult> {
    const type = s.type ?? EventType.OTHER;
    const snapshot = await this.memory.snapshot(userId);

    const look = await this.stylist.recommendLook({
      eventType: type,
      language: lang,
      memory: snapshot,
      whenText: s.whenText,
      place: s.place,
      weather: s.weather,
    });

    // Persiste Event -> Look -> History.
    const event = await this.prisma.event.create({
      data: {
        userId,
        type: type as never,
        place: s.place,
        weather: s.weather,
        notes: s.whenText,
      },
    });

    const lookRow = await this.prisma.look.create({
      data: {
        userId,
        eventId: event.id,
        description: look.text,
        items: look.items as object,
      },
    });

    await this.prisma.history.create({
      data: { userId, lookId: lookRow.id, eventType: type as never },
    });

    return { reply: look.text, context: { event: undefined }, done: true };
  }

  private askWhen(lang: Language): string {
    return lang === Language.EN
      ? 'Lovely! What time is it? (day/evening, and the date if you have it)'
      : 'Que ótimo! Qual o horário? (dia/noite, e a data se tiver)';
  }
  private askPlace(lang: Language): string {
    return lang === Language.EN
      ? 'And where will it be? (venue/city/indoor or outdoor)'
      : 'E onde será? (local/cidade/ambiente fechado ou ao ar livre)';
  }
  private askWeather(lang: Language): string {
    return lang === Language.EN
      ? 'How’s the weather expected to be? (hot, cold, rainy...)'
      : 'Como deve estar o clima? (calor, frio, chuva...)';
  }
}
