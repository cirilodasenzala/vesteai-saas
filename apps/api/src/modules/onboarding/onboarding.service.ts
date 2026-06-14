import { Injectable } from '@nestjs/common';
import { Language, Sex, Style } from '@vesteai/shared';
import { MemoryService } from '../memory/memory.service';

/**
 * OnboardingService — coleta o perfil passo a passo após o pagamento.
 * Ordem: nome -> idade -> sexo -> cor favorita -> estilo favorito
 *        -> (altura opcional) -> (peso opcional) -> concluído.
 *
 * O estado do passo vive no Conversation.context (passado como `ctx`).
 * Idioma NUNCA é perguntado (detectado automaticamente noutro fluxo).
 */

export type OnboardingStep =
  | 'name'
  | 'age'
  | 'sex'
  | 'color'
  | 'style'
  | 'height'
  | 'weight'
  | 'done';

export interface OnboardingContext {
  step?: OnboardingStep;
}

export interface OnboardingResult {
  /** Resposta a enviar ao usuário. */
  reply: string;
  /** Novo contexto a persistir. */
  context: OnboardingContext;
  /** true quando o onboarding terminou (caller deve ir para IDLE). */
  done: boolean;
}

const STYLE_LABELS: Record<string, Style> = {
  casual: Style.CASUAL,
  'old money': Style.OLD_MONEY,
  oldmoney: Style.OLD_MONEY,
  streetwear: Style.STREETWEAR,
  minimalista: Style.MINIMALISTA,
  minimalist: Style.MINIMALISTA,
  'quiet luxury': Style.QUIET_LUXURY,
  esportivo: Style.ESPORTIVO,
  sporty: Style.ESPORTIVO,
  elegante: Style.ELEGANTE,
  elegant: Style.ELEGANTE,
  social: Style.SOCIAL,
  formal: Style.FORMAL,
  luxury: Style.LUXURY,
  luxo: Style.LUXURY,
};

@Injectable()
export class OnboardingService {
  constructor(private readonly memory: MemoryService) {}

  /** Primeira pergunta (logo após ativar a assinatura). */
  start(lang: Language): OnboardingResult {
    return {
      reply:
        lang === Language.EN
          ? 'Your subscription is active! 🎉 Let’s set up your profile. First — what’s your name?'
          : 'Sua assinatura está ativa! 🎉 Vamos montar seu perfil. Para começar — qual é o seu nome?',
      context: { step: 'name' },
      done: false,
    };
  }

  /** Processa a resposta do usuário no passo atual. */
  async handle(
    userId: string,
    lang: Language,
    text: string,
    ctx: OnboardingContext,
  ): Promise<OnboardingResult> {
    const step = ctx.step ?? 'name';
    const answer = (text ?? '').trim();
    const en = lang === Language.EN;

    switch (step) {
      case 'name': {
        await this.memory.updateProfile(userId, { name: answer });
        return this.ask('age', en, { step: 'age' });
      }
      case 'age': {
        const age = parseInt(answer.replace(/\D/g, ''), 10);
        if (age) await this.memory.updateProfile(userId, { age });
        return this.ask('sex', en, { step: 'sex' });
      }
      case 'sex': {
        const sex = this.parseSex(answer);
        if (sex) await this.memory.updateProfile(userId, { sex });
        return this.ask('color', en, { step: 'color' });
      }
      case 'color': {
        if (answer)
          await this.memory.updateProfile(userId, { favoriteColors: [answer] });
        return this.ask('style', en, { step: 'style' });
      }
      case 'style': {
        const style = STYLE_LABELS[answer.toLowerCase()];
        if (style) await this.memory.updateProfile(userId, { favoriteStyle: style });
        return this.ask('height', en, { step: 'height' });
      }
      case 'height': {
        if (!this.isSkip(answer)) {
          const h = parseInt(answer.replace(/\D/g, ''), 10);
          if (h) await this.memory.updateProfile(userId, { heightCm: h });
        }
        return this.ask('weight', en, { step: 'weight' });
      }
      case 'weight': {
        if (!this.isSkip(answer)) {
          const w = parseInt(answer.replace(/\D/g, ''), 10);
          if (w) await this.memory.updateProfile(userId, { weightKg: w });
        }
        return this.finish(en);
      }
      default:
        return this.finish(en);
    }
  }

  private ask(
    next: OnboardingStep,
    en: boolean,
    context: OnboardingContext,
  ): OnboardingResult {
    const prompts: Record<OnboardingStep, [string, string]> = {
      name: ['What’s your name?', 'Qual é o seu nome?'],
      age: ['How old are you?', 'Quantos anos você tem?'],
      sex: [
        'How do you identify? (male / female / other)',
        'Como você se identifica? (masculino / feminino / outro)',
      ],
      color: ['What’s your favorite color?', 'Qual é a sua cor favorita?'],
      style: [
        'Which style do you love most? (Casual, Old Money, Streetwear, Minimalista, Quiet Luxury, Esportivo, Elegante, Social, Formal, Luxury)',
        'Qual estilo você mais ama? (Casual, Old Money, Streetwear, Minimalista, Quiet Luxury, Esportivo, Elegante, Social, Formal, Luxury)',
      ],
      height: [
        'Your height in cm? (optional — type "skip")',
        'Sua altura em cm? (opcional — digite "pular")',
      ],
      weight: [
        'Your weight in kg? (optional — type "skip")',
        'Seu peso em kg? (opcional — digite "pular")',
      ],
      done: ['All set!', 'Tudo pronto!'],
    };
    const [enText, ptText] = prompts[next];
    return { reply: en ? enText : ptText, context, done: false };
  }

  private finish(en: boolean): OnboardingResult {
    return {
      reply: en
        ? 'Perfect — your profile is ready! ✨ Now I’m fully your stylist. Want to try on a piece, get a look for an occasion, or some advice?'
        : 'Perfeito — seu perfil está pronto! ✨ Agora sou totalmente seu stylist. Quer experimentar uma peça, um look para uma ocasião, ou uma dica?',
      context: { step: 'done' },
      done: true,
    };
  }

  private parseSex(answer: string): Sex | null {
    const a = answer.toLowerCase();
    if (/(masc|male|homem|m\b)/.test(a)) return Sex.MALE;
    if (/(fem|female|mulher|f\b)/.test(a)) return Sex.FEMALE;
    if (/(outro|other|n[ãa]o)/.test(a)) return Sex.OTHER;
    return null;
  }

  private isSkip(answer: string): boolean {
    return /(pular|skip|n[ãa]o|nao|-)/i.test(answer.trim());
  }
}
