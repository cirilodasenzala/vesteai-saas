import { EventType } from '@vesteai/shared';

/**
 * Detecta o tipo de evento a partir do texto do usuário (PT/EN).
 * Heurística por palavras-chave — cobre os casos do produto:
 * casamento, entrevista, sair, igreja, viajar, praia, faculdade,
 * trabalho, academia, jantar, festa, formatura, evento empresarial.
 */
const PATTERNS: Array<[RegExp, EventType]> = [
  [/casamento|wedding/i, EventType.WEDDING],
  [/entrevista|interview/i, EventType.INTERVIEW],
  [/igreja|culto|missa|church/i, EventType.CHURCH],
  [/viaj|viagem|travel|trip/i, EventType.TRAVEL],
  [/praia|beach/i, EventType.BEACH],
  [/faculdade|universidade|college|university/i, EventType.COLLEGE],
  [/academia|treino|gym|workout/i, EventType.GYM],
  [/jantar|dinner/i, EventType.DINNER],
  [/formatura|graduation/i, EventType.GRADUATION],
  [/empresarial|corporativo|corporate|networking/i, EventType.CORPORATE],
  [/festa|balada|party/i, EventType.PARTY],
  [/trabalh|work|escritório|office/i, EventType.WORK],
  [/sair|passear|going out|go out/i, EventType.GOING_OUT],
];

export function detectEventType(text: string): EventType {
  for (const [re, type] of PATTERNS) {
    if (re.test(text)) return type;
  }
  return EventType.OTHER;
}

/**
 * Quais eventos pedem detalhes antes de montar o look.
 * Ex.: casamento/jantar/festa/empresarial pedem horário/local/clima;
 * academia/praia são diretos.
 */
const NEEDS_DETAILS = new Set<EventType>([
  EventType.WEDDING,
  EventType.DINNER,
  EventType.PARTY,
  EventType.CORPORATE,
  EventType.GRADUATION,
  EventType.INTERVIEW,
]);

export function eventNeedsDetails(type: EventType): boolean {
  return NEEDS_DETAILS.has(type);
}
