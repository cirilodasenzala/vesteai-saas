/**
 * Porta (interface) do provedor de pagamento.
 * Abstrai Stripe (real) e o provider simulado, selecionados no
 * composition root conforme a presença de STRIPE_SECRET_KEY.
 *
 * Abstract class serve como token de DI no NestJS.
 */

export interface CheckoutLinkInput {
  /** Número do WhatsApp do lead (E.164 sem "+"). */
  whatsappNumber: string;
  /** userId, se o usuário já existir. */
  userId?: string;
}

export interface CheckoutLinkResult {
  url: string;
  /** Identificador do checkout/sessão no provedor (para rastreio). */
  externalId?: string;
}

/** Tipos de evento de pagamento normalizados (vindos do webhook). */
export type PaymentEventType =
  | 'CHECKOUT_COMPLETED'
  | 'SUBSCRIPTION_RENEWED'
  | 'SUBSCRIPTION_CANCELED'
  | 'PAYMENT_FAILED';

export interface PaymentEvent {
  type: PaymentEventType;
  whatsappNumber?: string;
  externalCustomerId?: string;
  externalSubId?: string;
  externalEventId?: string; // idempotência
  amount?: number;
  currency?: string;
  currentPeriodEnd?: Date;
  raw?: unknown;
}

export abstract class PaymentProvider {
  /** Nome do driver ativo (ex.: 'stripe' | 'simulated') — para logs. */
  abstract readonly driver: string;

  /** Cria um link de checkout para a assinatura Premium mensal. */
  abstract createCheckoutLink(
    input: CheckoutLinkInput,
  ): Promise<CheckoutLinkResult>;

  /**
   * Verifica e normaliza um webhook de pagamento. Recebe o corpo BRUTO
   * (Buffer) e a assinatura para validação. Retorna null se inválido/ignorável.
   */
  abstract parseWebhook(
    rawBody: Buffer,
    signature: string | undefined,
  ): PaymentEvent | null;

  /** Cancela uma assinatura no provedor. */
  abstract cancelSubscription(externalSubId: string): Promise<void>;
}
