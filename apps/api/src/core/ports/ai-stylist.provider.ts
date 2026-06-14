import { EventType, Intent, Language } from '@vesteai/shared';

/**
 * Porta (interface) do "cérebro" do stylist (LLM).
 * Implementações: GeminiStylistProvider (real) e MockStylistProvider.
 *
 * Fase 2: detectLanguage. Fase 3: reply, classifyIntent, recommendLook,
 * consultImage (persona premium "sempre explicar o porquê").
 */

export interface UserMemorySnapshot {
  name?: string | null;
  age?: number | null;
  sex?: string | null;
  language: Language;
  favoriteStyle?: string | null;
  favoriteColors?: string[];
  summary?: string | null;
}

export interface StylistContext {
  /** Texto recebido do usuário. */
  text: string;
  /** Memória/perfil para personalização. */
  memory: UserMemorySnapshot;
  /** Histórico recente (mensagens) para contexto, opcional. */
  recent?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface StylistReply {
  text: string;
}

/** Contexto para recomendação de look por ocasião/evento. */
export interface EventContext {
  eventType: EventType;
  language: Language;
  memory: UserMemorySnapshot;
  /** Detalhes coletados (horário, local, clima) — texto livre. */
  whenText?: string;
  place?: string;
  weather?: string;
}

/** Look estruturado retornado pelo stylist. */
export interface LookRecommendation {
  /** Texto pronto para enviar ao usuário (com a justificativa). */
  text: string;
  /** Peças sugeridas (estrutura para persistir em Look.items). */
  items: {
    top?: string;
    bottom?: string;
    footwear?: string;
    outerwear?: string;
    accessories?: string[];
    watch?: string;
    [k: string]: unknown;
  };
}

export interface ConsultInput {
  question: string;
  language: Language;
  memory: UserMemorySnapshot;
  /** URL da imagem (quando a consulta envolve uma foto). */
  imageUrl?: string;
  /** Imagem em base64 (entregue pela Evolution no webhook). */
  imageBase64?: string;
}

/** Resultado da avaliação de um look (nota + justificativa). */
export interface OutfitScore {
  /** Nota de 0 a 10 (ex.: 8.7). */
  score: number;
  /** Justificativa detalhada e elegante. */
  reason: string;
  /** Texto pronto para enviar ao usuário. */
  text: string;
}

export abstract class AIStylistProvider {
  abstract readonly driver: string;

  /** Detecta o idioma do texto (PT/EN/OTHER). */
  abstract detectLanguage(text: string): Promise<Language>;

  /** Resposta conversacional do stylist (persona premium). */
  abstract reply(ctx: StylistContext): Promise<StylistReply>;

  /** Classifica a intenção de uma mensagem no estado IDLE. */
  abstract classifyIntent(text: string): Promise<Intent>;

  /** Monta um look completo para uma ocasião, com justificativa. */
  abstract recommendLook(ctx: EventContext): Promise<LookRecommendation>;

  /** Consultoria de imagem ("essa roupa combina?", nota de look, etc.). */
  abstract consultImage(input: ConsultInput): Promise<string>;

  /** Avalia um look e dá uma nota (ex.: 8,7/10) com justificativa. */
  abstract scoreOutfit(input: ConsultInput): Promise<OutfitScore>;

  /** Sugere uma paleta de cores a partir de uma selfie/descrição. */
  abstract colorPalette(input: ConsultInput): Promise<string>;
}
