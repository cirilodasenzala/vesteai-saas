import { Inject, Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import type { AppConfig } from '../../../config/config.module';
import {
  CheckoutLinkInput,
  CheckoutLinkResult,
  PaymentEvent,
  PaymentProvider,
} from '../../../core/ports/payment.provider';

/**
 * Provider de pagamento real via Stripe (assinatura mensal Premium).
 * Selecionado quando STRIPE_SECRET_KEY está presente.
 *
 * O webhook é verificado com STRIPE_WEBHOOK_SECRET sobre o corpo bruto.
 */
@Injectable()
export class StripePaymentProvider extends PaymentProvider {
  readonly driver = 'stripe';
  private readonly logger = new Logger(StripePaymentProvider.name);
  private readonly stripe: Stripe;

  constructor(@Inject('APP_CONFIG') private readonly config: AppConfig) {
    super();
    if (!config.STRIPE_SECRET_KEY) {
      throw new Error('StripePaymentProvider requer STRIPE_SECRET_KEY.');
    }
    this.stripe = new Stripe(config.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
    });
  }

  async createCheckoutLink(
    input: CheckoutLinkInput,
  ): Promise<CheckoutLinkResult> {
    const priceId = this.config.STRIPE_PRICE_ID_PREMIUM_MONTHLY;
    if (!priceId) {
      throw new Error('STRIPE_PRICE_ID_PREMIUM_MONTHLY não configurado.');
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: this.config.STRIPE_SUCCESS_URL,
      cancel_url: this.config.STRIPE_CANCEL_URL,
      // Liga o número do WhatsApp à sessão para reconciliar no webhook.
      client_reference_id: input.whatsappNumber,
      metadata: {
        whatsappNumber: input.whatsappNumber,
        userId: input.userId ?? '',
      },
    });

    return { url: session.url ?? '', externalId: session.id };
  }

  parseWebhook(
    rawBody: Buffer,
    signature: string | undefined,
  ): PaymentEvent | null {
    const secret = this.config.STRIPE_WEBHOOK_SECRET;
    if (!secret || !signature) {
      this.logger.warn('Webhook Stripe sem segredo/assinatura — rejeitado.');
      return null;
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (err) {
      this.logger.warn(`Assinatura do webhook Stripe inválida: ${(err as Error).message}`);
      return null;
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        return {
          type: 'CHECKOUT_COMPLETED',
          whatsappNumber:
            s.client_reference_id ??
            (s.metadata?.whatsappNumber as string | undefined),
          externalCustomerId: (s.customer as string) ?? undefined,
          externalSubId: (s.subscription as string) ?? undefined,
          externalEventId: event.id,
          amount: s.amount_total ?? undefined,
          currency: s.currency ?? undefined,
          raw: event,
        };
      }
      case 'invoice.paid': {
        const inv = event.data.object as Stripe.Invoice;
        return {
          type: 'SUBSCRIPTION_RENEWED',
          externalCustomerId: (inv.customer as string) ?? undefined,
          externalSubId: (inv.subscription as string) ?? undefined,
          externalEventId: event.id,
          raw: event,
        };
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        return {
          type: 'SUBSCRIPTION_CANCELED',
          externalCustomerId: (sub.customer as string) ?? undefined,
          externalSubId: sub.id,
          externalEventId: event.id,
          raw: event,
        };
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        return {
          type: 'PAYMENT_FAILED',
          externalCustomerId: (inv.customer as string) ?? undefined,
          externalSubId: (inv.subscription as string) ?? undefined,
          externalEventId: event.id,
          raw: event,
        };
      }
      default:
        return null;
    }
  }

  async cancelSubscription(externalSubId: string): Promise<void> {
    await this.stripe.subscriptions.cancel(externalSubId);
  }
}
