import { Injectable } from '@nestjs/common';
import { EventType, Intent, Language } from '@vesteai/shared';
import {
  AIStylistProvider,
  ConsultInput,
  EventContext,
  LookRecommendation,
  OutfitScore,
  StylistContext,
  StylistReply,
} from '../../../core/ports/ai-stylist.provider';
import { detectLanguageHeuristic } from '../language-detect';

/**
 * Implementação MOCK do stylist (sem Gemini). Determinística — ideal
 * para testes e para rodar sem GEMINI_API_KEY. Detecção de idioma via
 * heurística; respostas/intenção por regras simples.
 */
@Injectable()
export class MockStylistProvider extends AIStylistProvider {
  readonly driver = 'mock';

  async detectLanguage(text: string): Promise<Language> {
    return detectLanguageHeuristic(text);
  }

  async reply(ctx: StylistContext): Promise<StylistReply> {
    const lang = detectLanguageHeuristic(ctx.text);
    const name = ctx.memory.name ?? '';
    const greet = name ? ` ${name}` : '';
    const text =
      lang === Language.EN
        ? `Lovely${greet}! I'm your VesteAI stylist. (mock) You said: "${ctx.text}"`
        : `Perfeito${greet}! Sou seu stylist VesteAI. (mock) Você disse: "${ctx.text}"`;
    return { text };
  }

  async classifyIntent(text: string): Promise<Intent> {
    const t = (text || '').toLowerCase();
    if (/(nota|avalia|score|rate)/.test(t)) return Intent.SCORE;
    if (/(paleta|palette|cores que|color palette)/.test(t)) return Intent.PALETTE;
    if (/(indica|convidar|refer|invite|cupom|código|codigo)/.test(t))
      return Intent.REFERRAL;
    // "monte/combine um look com minhas roupas" -> usar guarda-roupa.
    if (/(monte|montar|combina[r]?|build|create).*(minhas roupas|guarda-?roupa|my clothes|wardrobe)/.test(t))
      return Intent.WARDROBE_USE;
    // "cadastrar/guardar/adicionar (minhas) roupas" -> intake.
    if (/(cadastr|guardar|adicionar|salvar|add).*(roupa|clothes)/.test(t))
      return Intent.WARDROBE_ADD;
    if (/(experimentar|provar|try on|try)/.test(t)) return Intent.TRYON;
    if (/(casamento|entrevista|festa|jantar|wedding|party|interview)/.test(t))
      return Intent.EVENT;
    if (/(combina|fica bom|match|looks good|elegante)/.test(t))
      return Intent.CONSULT;
    if (/(guarda-?roupa|wardrobe|minhas roupas|my clothes)/.test(t))
      return Intent.WARDROBE_USE;
    return Intent.CHAT;
  }

  async recommendLook(ctx: EventContext): Promise<LookRecommendation> {
    const en = ctx.language === Language.EN;
    const label = EVENT_LABEL[ctx.eventType]?.[en ? 1 : 0] ?? 'evento';
    const items = {
      top: en ? 'tailored shirt' : 'camisa bem cortada',
      bottom: en ? 'navy trousers' : 'calça azul-marinho',
      footwear: en ? 'leather loafers' : 'mocassim de couro',
      accessories: [en ? 'minimal watch' : 'relógio discreto'],
    };
    const text = en
      ? `For your ${label}, I suggest a ${items.top} with ${items.bottom} and ${items.footwear}. (mock) The palette stays elegant and the proportions flatter you.`
      : `Para o seu ${label}, sugiro ${items.top} com ${items.bottom} e ${items.footwear}. (mock) A paleta fica elegante e as proporções te valorizam.`;
    return { text, items };
  }

  async consultImage(input: ConsultInput): Promise<string> {
    const en = input.language === Language.EN;
    return en
      ? `Great question! (mock) That choice works well — the colors harmonize and the fit suits your style.`
      : `Ótima pergunta! (mock) Essa escolha funciona bem — as cores harmonizam e o caimento combina com o seu estilo.`;
  }

  async scoreOutfit(input: ConsultInput): Promise<OutfitScore> {
    const en = input.language === Language.EN;
    const score = 8.7;
    const reason = en
      ? 'balanced proportions, a refined palette and elegant footwear'
      : 'proporções equilibradas, paleta refinada e calçado elegante';
    const text = en
      ? `I’d give this look ${score}/10 — ${reason}. (mock)`
      : `Eu daria nota ${String(score).replace('.', ',')}/10 para esse look — ${reason}. (mock)`;
    return { score, reason, text };
  }

  async colorPalette(input: ConsultInput): Promise<string> {
    const en = input.language === Language.EN;
    return en
      ? 'Your palette (mock): deep navy, warm beige, off-white and a touch of burgundy — they flatter your tone.'
      : 'Sua paleta (mock): azul-marinho profundo, bege quente, off-white e um toque de bordô — valorizam o seu tom.';
  }
}

/** Rótulos PT/EN por tipo de evento (para mensagens do mock). */
const EVENT_LABEL: Partial<Record<EventType, [string, string]>> = {
  [EventType.WEDDING]: ['casamento', 'wedding'],
  [EventType.INTERVIEW]: ['entrevista', 'interview'],
  [EventType.PARTY]: ['festa', 'party'],
  [EventType.DINNER]: ['jantar', 'dinner'],
  [EventType.WORK]: ['trabalho', 'work day'],
  [EventType.BEACH]: ['dia de praia', 'beach day'],
  [EventType.GRADUATION]: ['formatura', 'graduation'],
  [EventType.CORPORATE]: ['evento empresarial', 'corporate event'],
};
