import { Inject, Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { Intent, Language } from '@vesteai/shared';
import type { AppConfig } from '../../../config/config.module';
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
 * Stylist real via Google Gemini. Selecionado quando AI_DRIVER=gemini
 * e GEMINI_API_KEY presente. Encapsula a persona premium "sempre
 * explicar o porquê" no system prompt.
 *
 * Fase 2 usa principalmente detectLanguage; reply/classifyIntent ganham
 * prompts mais ricos na Fase 3.
 */
@Injectable()
export class GeminiStylistProvider extends AIStylistProvider {
  readonly driver = 'gemini';
  private readonly logger = new Logger(GeminiStylistProvider.name);
  private readonly model: GenerativeModel;

  private static readonly PERSONA = [
    'Você é o VesteAI, um Personal Stylist Premium de luxo.',
    'Tom: elegante, educado, conversacional, sofisticado — nunca robótico.',
    'Sempre explique o PORQUÊ: por que a roupa/combinação funciona, cores,',
    'tecidos, acessórios, calçado, relógio/corrente/blazer/jaqueta.',
    'Responda SEMPRE no mesmo idioma da última mensagem do usuário.',
  ].join(' ');

  constructor(@Inject('APP_CONFIG') private readonly config: AppConfig) {
    super();
    if (!config.GEMINI_API_KEY) {
      throw new Error('GeminiStylistProvider requer GEMINI_API_KEY.');
    }
    const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    this.model = genAI.getGenerativeModel({
      model: config.GEMINI_MODEL,
      systemInstruction: GeminiStylistProvider.PERSONA,
    });
  }

  async detectLanguage(text: string): Promise<Language> {
    // Heurística primeiro (barata); só chama o LLM em caso ambíguo.
    const guess = detectLanguageHeuristic(text);
    if (guess !== Language.PT || /[áàâãéêíóôõúç]/i.test(text)) return guess;

    try {
      const res = await this.model.generateContent(
        `Responda APENAS com um código: PT, EN ou OTHER. ` +
          `Qual o idioma deste texto? """${text.slice(0, 500)}"""`,
      );
      const out = res.response.text().trim().toUpperCase();
      if (out.includes('PT')) return Language.PT;
      if (out.includes('EN')) return Language.EN;
      return Language.OTHER;
    } catch (err) {
      this.logger.warn(`Falha na detecção via Gemini, usando heurística: ${(err as Error).message}`);
      return guess;
    }
  }

  async reply(ctx: StylistContext): Promise<StylistReply> {
    try {
      const profile = JSON.stringify(ctx.memory);
      const res = await this.model.generateContent(
        `Perfil do usuário (memória): ${profile}\n\n` +
          `Mensagem do usuário: ${ctx.text}\n\n` +
          `Responda como o stylist premium, no idioma do usuário.`,
      );
      return { text: res.response.text().trim() };
    } catch (err) {
      this.logger.error('Falha ao gerar resposta no Gemini.', err as Error);
      return {
        text: 'Tive um contratempo agora, mas já estou de volta. Pode repetir? ✨',
      };
    }
  }

  async classifyIntent(text: string): Promise<Intent> {
    try {
      const res = await this.model.generateContent(
        `Classifique a intenção da mensagem em UMA palavra dentre: ` +
          `EVENT, TRYON, CONSULT, WARDROBE_ADD, WARDROBE_USE, SCORE, PALETTE, REFERRAL, CHAT.\n` +
          `Mensagem: """${text}"""\nResponda só a palavra.`,
      );
      const out = res.response.text().trim().toUpperCase();
      const match = (Object.values(Intent) as string[]).find((i) =>
        out.includes(i),
      );
      return (match as Intent) ?? Intent.CHAT;
    } catch {
      return Intent.CHAT;
    }
  }

  async recommendLook(ctx: EventContext): Promise<LookRecommendation> {
    const en = ctx.language === Language.EN;
    const details = [
      ctx.whenText && `horário: ${ctx.whenText}`,
      ctx.place && `local: ${ctx.place}`,
      ctx.weather && `clima: ${ctx.weather}`,
    ]
      .filter(Boolean)
      .join(', ');

    try {
      const res = await this.model.generateContent(
        `Monte um look completo para a ocasião "${ctx.eventType}". ` +
          `Detalhes: ${details || 'não informados'}. ` +
          `Perfil: ${JSON.stringify(ctx.memory)}.\n` +
          `Explique o PORQUÊ (cores, tecidos, calçado, acessórios). ` +
          `Ao final, em uma última linha, devolva um JSON entre <ITEMS> e </ITEMS> ` +
          `com chaves top, bottom, footwear, outerwear, accessories (array), watch.\n` +
          `Responda no idioma ${en ? 'inglês' : 'português'}.`,
      );
      const full = res.response.text().trim();
      const items = this.extractItems(full);
      const text = full.replace(/<ITEMS>[\s\S]*?<\/ITEMS>/i, '').trim();
      return { text, items };
    } catch (err) {
      this.logger.error('Falha ao recomendar look no Gemini.', err as Error);
      return {
        text: en
          ? 'I had a hiccup composing your look — shall we try again?'
          : 'Tive um contratempo montando seu look — vamos tentar de novo?',
        items: {},
      };
    }
  }

  async consultImage(input: ConsultInput): Promise<string> {
    try {
      const parts: Array<string | { inlineData: { data: string; mimeType: string } }> =
        [
          `Pergunta de consultoria: ${input.question}\n` +
            `Perfil: ${JSON.stringify(input.memory)}.\n` +
            `Responda como stylist premium, sempre justificando, no idioma ${
              input.language === Language.EN ? 'inglês' : 'português'
            }.`,
        ];
      // Imagem (quando houver) é anexada na Fase 4 com download da mídia.
      const res = await this.model.generateContent(parts as string[]);
      return res.response.text().trim();
    } catch (err) {
      this.logger.error('Falha na consultoria no Gemini.', err as Error);
      return input.language === Language.EN
        ? 'Let me take another look — could you resend that?'
        : 'Deixa eu olhar com calma — pode reenviar?';
    }
  }

  async scoreOutfit(input: ConsultInput): Promise<OutfitScore> {
    const en = input.language === Language.EN;
    try {
      const res = await this.model.generateContent(
        `Avalie o look descrito e dê uma nota de 0 a 10 (uma casa decimal). ` +
          `Contexto/pergunta: ${input.question}. Perfil: ${JSON.stringify(input.memory)}.\n` +
          `Justifique de forma elegante (cores, caimento, proporção, ocasião). ` +
          `Na PRIMEIRA linha coloque SOMENTE a nota no formato SCORE=8.7. ` +
          `Responda no idioma ${en ? 'inglês' : 'português'}.`,
      );
      const full = res.response.text().trim();
      const m = full.match(/SCORE\s*=\s*([0-9]+(?:[.,][0-9]+)?)/i);
      const score = m ? parseFloat(m[1].replace(',', '.')) : 8.0;
      const reason = full.replace(/^.*SCORE\s*=\s*[0-9.,]+\s*/i, '').trim();
      return { score, reason, text: full.replace(/SCORE\s*=\s*[0-9.,]+\s*/i, '').trim() };
    } catch (err) {
      this.logger.error('Falha ao avaliar look no Gemini.', err as Error);
      return {
        score: 0,
        reason: '',
        text: en ? 'Let me look again — resend it?' : 'Deixa eu olhar de novo — reenvia?',
      };
    }
  }

  async colorPalette(input: ConsultInput): Promise<string> {
    try {
      const res = await this.model.generateContent(
        `Sugira uma paleta de cores que valorize a pessoa. ` +
          `Descrição/selfie: ${input.question}. Perfil: ${JSON.stringify(input.memory)}.\n` +
          `Liste 4-6 cores com o porquê, no idioma ${
            input.language === Language.EN ? 'inglês' : 'português'
          }.`,
      );
      return res.response.text().trim();
    } catch {
      return input.language === Language.EN
        ? 'I couldn’t read that — could you resend the selfie?'
        : 'Não consegui analisar — pode reenviar a selfie?';
    }
  }

  /** Extrai o JSON de itens do bloco <ITEMS>…</ITEMS>, se presente. */
  private extractItems(text: string): LookRecommendation['items'] {
    const m = text.match(/<ITEMS>([\s\S]*?)<\/ITEMS>/i);
    if (!m) return {};
    try {
      return JSON.parse(m[1].trim());
    } catch {
      return {};
    }
  }
}
