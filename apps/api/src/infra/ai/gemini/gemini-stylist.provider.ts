import { Inject, Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
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

/** Parte de conteúdo aceita pelo @google/genai (texto ou imagem inline). */
type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

/**
 * Stylist real via Google Gemini (SDK @google/genai).
 *
 * Suporta dois modos de autenticação:
 *  - GEMINI_USE_VERTEX=true  -> chaves "AQ." (Vertex AI Express Mode).
 *  - GEMINI_USE_VERTEX=false -> chaves "AIza" (Google AI Studio).
 *
 * Encapsula a persona premium e a análise de imagem (visão). Em caso de
 * erro no modelo principal, tenta o GEMINI_FALLBACK_MODEL antes de desistir.
 */
@Injectable()
export class GeminiStylistProvider extends AIStylistProvider {
  readonly driver = 'gemini';
  private readonly logger = new Logger(GeminiStylistProvider.name);
  private readonly ai: GoogleGenAI;
  private readonly model: string;
  private readonly fallbackModel: string;

  private static readonly PERSONA = [
    'Você é o VesteAI, um Personal Stylist Premium de luxo.',
    'Tom: elegante, educado, conversacional, sofisticado — nunca robótico.',
    'Sempre explique o PORQUÊ: por que a roupa/combinação funciona, cores,',
    'tecidos, acessórios, calçado, relógio/corrente/blazer/jaqueta.',
    'Responda SEMPRE no mesmo idioma da última mensagem do usuário.',
  ].join(' ');

  constructor(@Inject('APP_CONFIG') private readonly config: AppConfig) {
    super();
    this.ai = GeminiStylistProvider.buildClient(config);
    this.model = config.GEMINI_MODEL;
    this.fallbackModel = config.GEMINI_FALLBACK_MODEL;
  }

  /**
   * Cria o client conforme a credencial disponível, em ordem de prioridade:
   *  1) Vertex + Service Account (GOOGLE_CREDENTIALS_JSON) — OAuth2.
   *  2) Vertex + API key "AQ." (Express Mode).
   *  3) Gemini Developer API + API key "AIza".
   */
  private static buildClient(config: AppConfig): GoogleGenAI {
    const log = new Logger(GeminiStylistProvider.name);

    // (1) Service Account JSON (Vertex via OAuth2).
    if (config.GEMINI_USE_VERTEX && config.GOOGLE_CREDENTIALS_JSON) {
      const sa = GeminiStylistProvider.parseServiceAccount(
        config.GOOGLE_CREDENTIALS_JSON,
      );
      const project = config.GEMINI_VERTEX_PROJECT || sa.project_id;
      if (!project) {
        throw new Error(
          'Vertex Service Account requer GEMINI_VERTEX_PROJECT ou project_id no JSON.',
        );
      }
      log.log(
        `Gemini pronto (Vertex + Service Account, project=${project}, location=${config.GEMINI_VERTEX_LOCATION}, model=${config.GEMINI_MODEL}).`,
      );
      return new GoogleGenAI({
        vertexai: true,
        project,
        location: config.GEMINI_VERTEX_LOCATION,
        googleAuthOptions: {
          credentials: {
            client_email: sa.client_email,
            private_key: sa.private_key,
          },
        },
      });
    }

    if (!config.GEMINI_API_KEY) {
      throw new Error(
        'GeminiStylistProvider requer GEMINI_API_KEY ou GOOGLE_CREDENTIALS_JSON (Vertex).',
      );
    }

    // (2) Vertex Express com API key "AQ.".
    if (config.GEMINI_USE_VERTEX) {
      log.log(`Gemini pronto (Vertex + API key, model=${config.GEMINI_MODEL}).`);
      return new GoogleGenAI({ vertexai: true, apiKey: config.GEMINI_API_KEY });
    }

    // (3) Gemini Developer API com API key "AIza".
    log.log(`Gemini pronto (AI Studio, model=${config.GEMINI_MODEL}).`);
    return new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
  }

  /**
   * Faz o parse do JSON da Service Account de forma robusta. Aceita:
   *  - o JSON puro (com \n reais ou escapados no private_key);
   *  - o JSON inteiro codificado em base64 (recomendado p/ env, evita o
   *    erro "DECODER routines::unsupported" causado por \n corrompido).
   * Normaliza o private_key e valida o formato PEM.
   */
  private static parseServiceAccount(raw: string): {
    client_email: string;
    private_key: string;
    project_id?: string;
  } {
    const trimmed = raw.trim();
    let jsonText = trimmed;

    // Se não começa com "{", assume base64 do JSON.
    if (!trimmed.startsWith('{')) {
      try {
        jsonText = Buffer.from(trimmed, 'base64').toString('utf8');
      } catch {
        throw new Error('GOOGLE_CREDENTIALS_JSON inválido (não é JSON nem base64).');
      }
    }

    let sa: { client_email?: string; private_key?: string; project_id?: string };
    try {
      sa = JSON.parse(jsonText);
    } catch (e) {
      throw new Error(
        `GOOGLE_CREDENTIALS_JSON: JSON inválido (${(e as Error).message}). ` +
          'Dica: codifique o arquivo em base64 e cole o resultado.',
      );
    }

    if (!sa.client_email || !sa.private_key) {
      throw new Error('Service Account sem client_email/private_key.');
    }

    // Normaliza quebras de linha do private_key (\n escapado -> real).
    let key = sa.private_key;
    if (key.includes('\\n')) key = key.replace(/\\n/g, '\n');
    // Garante newline final (alguns colam sem).
    if (!key.endsWith('\n')) key += '\n';

    if (!key.includes('BEGIN PRIVATE KEY')) {
      throw new Error(
        'private_key da Service Account fora do formato PEM esperado. ' +
          'Cole o JSON via base64 para preservar as quebras de linha.',
      );
    }

    return {
      client_email: sa.client_email,
      private_key: key,
      project_id: sa.project_id,
    };
  }

  // ---------- Núcleo de geração ----------

  /**
   * Gera conteúdo a partir de parts (texto e/ou imagem). Tenta o modelo
   * principal; se falhar e houver fallback diferente, tenta o fallback.
   * Lança o erro final (os métodos públicos tratam e dão a resposta amigável).
   */
  private async generate(parts: Part[]): Promise<string> {
    try {
      return await this.callModel(this.model, parts);
    } catch (err) {
      this.logger.error(
        `Gemini (${this.model}) falhou: ${(err as Error).message}`,
      );
      if (this.fallbackModel && this.fallbackModel !== this.model) {
        this.logger.warn(`Tentando modelo de fallback: ${this.fallbackModel}`);
        return this.callModel(this.fallbackModel, parts);
      }
      throw err;
    }
  }

  private async callModel(model: string, parts: Part[]): Promise<string> {
    const res = await this.ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config: { systemInstruction: GeminiStylistProvider.PERSONA },
    });
    return (res.text ?? '').trim();
  }

  /** Remove o prefixo data:...;base64, deixando só a base64 pura. */
  private rawBase64(b64: string): string {
    const comma = b64.indexOf(',');
    return b64.startsWith('data:') && comma >= 0 ? b64.slice(comma + 1) : b64;
  }

  // ---------- Interface pública ----------

  async detectLanguage(text: string): Promise<Language> {
    const guess = detectLanguageHeuristic(text);
    if (guess !== Language.PT || /[áàâãéêíóôõúç]/i.test(text)) return guess;
    try {
      const out = (
        await this.generate([
          {
            text:
              `Responda APENAS com um código: PT, EN ou OTHER. ` +
              `Qual o idioma deste texto? """${text.slice(0, 500)}"""`,
          },
        ])
      ).toUpperCase();
      if (out.includes('PT')) return Language.PT;
      if (out.includes('EN')) return Language.EN;
      return Language.OTHER;
    } catch (err) {
      this.logger.warn(
        `Detecção via Gemini falhou, usando heurística: ${(err as Error).message}`,
      );
      return guess;
    }
  }

  async reply(ctx: StylistContext): Promise<StylistReply> {
    try {
      const text = await this.generate([
        {
          text:
            `Perfil do usuário (memória): ${JSON.stringify(ctx.memory)}\n\n` +
            `Mensagem do usuário: ${ctx.text}\n\n` +
            `Responda como o stylist premium, no idioma do usuário.`,
        },
      ]);
      return { text };
    } catch (err) {
      this.logger.error(`Falha ao gerar resposta: ${(err as Error).message}`);
      return {
        text: 'Tive um contratempo agora, mas já estou de volta. Pode repetir? ✨',
      };
    }
  }

  async classifyIntent(text: string): Promise<Intent> {
    try {
      const out = (
        await this.generate([
          {
            text:
              `Classifique a intenção da mensagem em UMA palavra dentre: ` +
              `EVENT, TRYON, CONSULT, WARDROBE_ADD, WARDROBE_USE, SCORE, PALETTE, REFERRAL, CHAT.\n` +
              `Mensagem: """${text}"""\nResponda só a palavra.`,
          },
        ])
      ).toUpperCase();
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
      const full = await this.generate([
        {
          text:
            `Monte um look completo para a ocasião "${ctx.eventType}". ` +
            `Detalhes: ${details || 'não informados'}. ` +
            `Perfil: ${JSON.stringify(ctx.memory)}.\n` +
            `Explique o PORQUÊ (cores, tecidos, calçado, acessórios). ` +
            `Ao final, em uma última linha, devolva um JSON entre <ITEMS> e </ITEMS> ` +
            `com chaves top, bottom, footwear, outerwear, accessories (array), watch.\n` +
            `Responda no idioma ${en ? 'inglês' : 'português'}.`,
        },
      ]);
      const items = this.extractItems(full);
      const text = full.replace(/<ITEMS>[\s\S]*?<\/ITEMS>/i, '').trim();
      return { text, items };
    } catch (err) {
      this.logger.error(`Falha ao recomendar look: ${(err as Error).message}`);
      return {
        text: en
          ? 'I had a hiccup composing your look — shall we try again?'
          : 'Tive um contratempo montando seu look — vamos tentar de novo?',
        items: {},
      };
    }
  }

  async consultImage(input: ConsultInput): Promise<string> {
    const en = input.language === Language.EN;
    try {
      const parts: Part[] = [
        {
          text:
            `Pergunta de consultoria: ${input.question || '(o usuário enviou uma foto)'}\n` +
            `Perfil: ${JSON.stringify(input.memory)}.\n` +
            `Analise a imagem (se houver) e responda como stylist premium, ` +
            `sempre justificando, no idioma ${en ? 'inglês' : 'português'}.`,
        },
      ];
      if (input.imageBase64) {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: this.rawBase64(input.imageBase64),
          },
        });
      }
      return await this.generate(parts);
    } catch (err) {
      this.logger.error(`Falha na consultoria: ${(err as Error).message}`);
      return en
        ? 'Let me take another look — could you resend that?'
        : 'Deixa eu olhar com calma — pode reenviar?';
    }
  }

  async scoreOutfit(input: ConsultInput): Promise<OutfitScore> {
    const en = input.language === Language.EN;
    try {
      const parts: Part[] = [
        {
          text:
            `Avalie o look e dê uma nota de 0 a 10 (uma casa decimal). ` +
            `Contexto/pergunta: ${input.question}. Perfil: ${JSON.stringify(input.memory)}.\n` +
            `Justifique de forma elegante (cores, caimento, proporção, ocasião). ` +
            `Na PRIMEIRA linha coloque SOMENTE a nota no formato SCORE=8.7. ` +
            `Responda no idioma ${en ? 'inglês' : 'português'}.`,
        },
      ];
      if (input.imageBase64) {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: this.rawBase64(input.imageBase64),
          },
        });
      }
      const full = await this.generate(parts);
      const m = full.match(/SCORE\s*=\s*([0-9]+(?:[.,][0-9]+)?)/i);
      const score = m ? parseFloat(m[1].replace(',', '.')) : 8.0;
      const text = full.replace(/SCORE\s*=\s*[0-9.,]+\s*/i, '').trim();
      return { score, reason: text, text };
    } catch (err) {
      this.logger.error(`Falha ao avaliar look: ${(err as Error).message}`);
      return {
        score: 0,
        reason: '',
        text: en ? 'Let me look again — resend it?' : 'Deixa eu olhar de novo — reenvia?',
      };
    }
  }

  async colorPalette(input: ConsultInput): Promise<string> {
    const en = input.language === Language.EN;
    try {
      const parts: Part[] = [
        {
          text:
            `Sugira uma paleta de cores que valorize a pessoa. ` +
            `Descrição/selfie: ${input.question}. Perfil: ${JSON.stringify(input.memory)}.\n` +
            `Liste 4-6 cores com o porquê, no idioma ${en ? 'inglês' : 'português'}.`,
        },
      ];
      if (input.imageBase64) {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: this.rawBase64(input.imageBase64),
          },
        });
      }
      return await this.generate(parts);
    } catch (err) {
      this.logger.error(`Falha na paleta: ${(err as Error).message}`);
      return en
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
