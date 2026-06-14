/**
 * @vesteai/shared — tipos e enums compartilhados entre API e Admin.
 * Mantém um único ponto de verdade para os domínios do produto.
 */

export enum Sex {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum Language {
  PT = 'PT',
  EN = 'EN',
  OTHER = 'OTHER',
}

/** Estilos suportados (espelham data/estilos.js do MVP legado). */
export enum Style {
  CASUAL = 'CASUAL',
  OLD_MONEY = 'OLD_MONEY',
  STREETWEAR = 'STREETWEAR',
  MINIMALISTA = 'MINIMALISTA',
  QUIET_LUXURY = 'QUIET_LUXURY',
  ESPORTIVO = 'ESPORTIVO',
  ELEGANTE = 'ELEGANTE',
  SOCIAL = 'SOCIAL',
  FORMAL = 'FORMAL',
  LUXURY = 'LUXURY',
}

export enum SubStatus {
  NONE = 'NONE',
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELED = 'CANCELED',
}

/** Estados da máquina de conversa do WhatsApp. */
export enum ConvState {
  NEW = 'NEW',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  ONBOARDING = 'ONBOARDING',
  IDLE = 'IDLE',
  TRYON_BODY = 'TRYON_BODY',
  TRYON_GARMENT = 'TRYON_GARMENT',
  TRYON_PROCESSING = 'TRYON_PROCESSING',
  EVENT_DETAILS = 'EVENT_DETAILS',
  CONSULTING = 'CONSULTING',
  WARDROBE_INTAKE = 'WARDROBE_INTAKE',
}

export enum MsgDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

export enum MsgType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  TEMPLATE = 'TEMPLATE',
  AUDIO = 'AUDIO',
  LOCATION = 'LOCATION',
}

export enum EventType {
  WEDDING = 'WEDDING',
  INTERVIEW = 'INTERVIEW',
  GOING_OUT = 'GOING_OUT',
  CHURCH = 'CHURCH',
  TRAVEL = 'TRAVEL',
  BEACH = 'BEACH',
  COLLEGE = 'COLLEGE',
  WORK = 'WORK',
  GYM = 'GYM',
  DINNER = 'DINNER',
  PARTY = 'PARTY',
  GRADUATION = 'GRADUATION',
  CORPORATE = 'CORPORATE',
  OTHER = 'OTHER',
}

export enum TryOnStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  DONE = 'DONE',
  FAILED = 'FAILED',
}

/** Intenção classificada de uma mensagem do usuário no estado IDLE. */
export enum Intent {
  EVENT = 'EVENT',
  TRYON = 'TRYON',
  CONSULT = 'CONSULT',
  WARDROBE_ADD = 'WARDROBE_ADD',
  WARDROBE_USE = 'WARDROBE_USE',
  SCORE = 'SCORE',
  PALETTE = 'PALETTE',
  REFERRAL = 'REFERRAL',
  CHAT = 'CHAT',
}

export const PREMIUM_PLAN_CODE = 'premium_monthly';
