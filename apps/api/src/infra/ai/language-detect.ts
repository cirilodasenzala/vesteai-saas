import { Language } from '@vesteai/shared';

/**
 * Heurística leve de detecção de idioma (PT/EN), sem dependência de LLM.
 * Usada pelo MockStylistProvider e como fallback rápido antes de chamar
 * o Gemini. Baseada em stopwords e caracteres acentuados típicos do PT.
 */
const PT_WORDS = [
  'você',
  'voce',
  'olá',
  'ola',
  'oi',
  'obrigado',
  'obrigada',
  'roupa',
  'estilo',
  'quero',
  'tenho',
  'casamento',
  'festa',
  'combina',
  'meu',
  'minha',
  'não',
  'nao',
  'sim',
  'bom',
  'boa',
  'para',
  'com',
  'isso',
  'agora',
];

const EN_WORDS = [
  'hello',
  'hi',
  'hey',
  'thanks',
  'thank',
  'clothes',
  'outfit',
  'style',
  'want',
  'have',
  'wedding',
  'party',
  'match',
  'my',
  'the',
  'yes',
  'good',
  'for',
  'with',
  'this',
  'now',
  'please',
];

export function detectLanguageHeuristic(text: string): Language {
  const t = (text || '').toLowerCase();
  if (!t.trim()) return Language.PT;

  // Acentos/cedilha são forte sinal de português.
  if (/[áàâãéêíóôõúçü]/.test(t)) return Language.PT;

  const tokens = t.split(/\W+/).filter(Boolean);
  let pt = 0;
  let en = 0;
  for (const tok of tokens) {
    if (PT_WORDS.includes(tok)) pt++;
    if (EN_WORDS.includes(tok)) en++;
  }

  if (pt > en) return Language.PT;
  if (en > pt) return Language.EN;
  // Empate/sem sinal: mantém o padrão do produto (PT).
  return Language.PT;
}
