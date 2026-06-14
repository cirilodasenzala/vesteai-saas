import { Inject, Injectable, Logger } from '@nestjs/common';
import { PREMIUM_PLAN_CODE } from '@vesteai/shared';
import type { AppConfig } from '../../../config/config.module';
import {
  CheckoutLinkInput,
  CheckoutLinkResult,
  PaymentEvent,
  PaymentProvider,
} from '../../../core/ports/payment.provider';

/**
 * Provider de pagamento SIMULADO (sem Stripe).
 * - createCheckoutLink retorna uma URL local /dev/pay/:token.
 *   Acessá-la dispara o mesmo PaymentEvent CHECKOUT_COMPLETED que o
 *   webhook real do Stripe geraria (ver DevPayController).
 * - parseWebhook não é usado neste modo (não há webhook externo).
 *
 * O token codifica o número do WhatsApp em base64url para reconstruir
 * o evento ao ser acessado.
 */
@Injectable()
export class SimulatedPaymentProvider extends PaymentProvider {
  readonly driver = 'simulated';
  private readonly logger = new Logger(SimulatedPaymentProvider.name);

  constructor(@Inject('APP_CONFIG') private readonly config: AppConfig) {
    super();
    this.logger.warn(
      'Pagamento em modo SIMULADO — checkout via /dev/pay/:token (sem Stripe).',
    );
  }

  async createCheckoutLink(
    input: CheckoutLinkInput,
  ): Promise<CheckoutLinkResult> {
    const token = Buffer.from(input.whatsappNumber, 'utf8').toString(
      'base64url',
    );
    const url = `${this.config.APP_BASE_URL}/dev/pay/${token}`;
    return { url, externalId: `sim_${token}` };
  }

  parseWebhook(): PaymentEvent | null {
    // Sem webhook externo no modo simulado.
    return null;
  }

  async cancelSubscription(externalSubId: string): Promise<void> {
    this.logger.log(`[SIMULADO] cancelar assinatura ${externalSubId}`);
  }

  /** Decodifica o token do link de pagamento simulado. */
  static decodeToken(token: string): string {
    return Buffer.from(token, 'base64url').toString('utf8');
  }

  /** Monta o evento que o /dev/pay dispara ao ser acessado. */
  static buildSimulatedEvent(whatsappNumber: string): PaymentEvent {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    return {
      type: 'CHECKOUT_COMPLETED',
      whatsappNumber,
      externalCustomerId: `sim_cus_${whatsappNumber}`,
      externalSubId: `sim_sub_${whatsappNumber}`,
      externalEventId: `sim_evt_${whatsappNumber}_${now.getTime()}`,
      amount: 4990,
      currency: 'brl',
      currentPeriodEnd: periodEnd,
      raw: { plan: PREMIUM_PLAN_CODE, simulated: true },
    };
  }
}
