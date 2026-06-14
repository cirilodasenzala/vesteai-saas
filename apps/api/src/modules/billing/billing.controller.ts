import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AppConfig } from '../../config/config.module';
import { PaymentProvider } from '../../core/ports/payment.provider';
import { SimulatedPaymentProvider } from '../../infra/payment/simulated/simulated-payment.provider';
import { SubscriptionService } from '../subscription/subscription.service';
import { ConversationService } from '../conversation/conversation.service';

/**
 * Webhooks e endpoints de pagamento.
 *  - POST /webhooks/stripe    -> webhook real (assinatura verificada).
 *  - GET  /dev/pay/:token     -> SÓ DEV — simula a confirmação do pagamento,
 *                                disparando o mesmo fluxo do webhook real.
 *
 * Ambos: aplicam o PaymentEvent -> ativam assinatura -> iniciam onboarding.
 */
@Controller()
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(
    @Inject('APP_CONFIG') private readonly config: AppConfig,
    private readonly payment: PaymentProvider,
    private readonly subscription: SubscriptionService,
    private readonly conversation: ConversationService,
  ) {}

  @Post('webhooks/stripe')
  @HttpCode(200)
  async stripeWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: true }> {
    const event = this.payment.parseWebhook(req.rawBody ?? Buffer.alloc(0), signature);
    if (event) {
      const { userId } = await this.subscription.applyPaymentEvent(event);
      if (event.type === 'CHECKOUT_COMPLETED' && event.whatsappNumber) {
        await this.conversation.beginOnboarding(event.whatsappNumber);
      } else if (userId) {
        this.logger.debug(`Evento ${event.type} aplicado para user ${userId}`);
      }
    }
    return { received: true };
  }

  /** Simulador de pagamento (dev): acessar o link "confirma" a compra. */
  @Get('dev/pay/:token')
  async devPay(@Param('token') token: string): Promise<string> {
    if (this.config.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
    const whatsappNumber = SimulatedPaymentProvider.decodeToken(token);
    const event = SimulatedPaymentProvider.buildSimulatedEvent(whatsappNumber);

    await this.subscription.applyPaymentEvent(event);
    await this.conversation.beginOnboarding(whatsappNumber);

    this.logger.log(`[DEV] Pagamento simulado confirmado para ${whatsappNumber}`);
    return (
      `<html><body style="font-family:sans-serif;text-align:center;padding:40px">` +
      `<h2>✅ Pagamento simulado confirmado</h2>` +
      `<p>VesteAI Premium ativado para <b>${whatsappNumber}</b>.</p>` +
      `<p>Volte ao WhatsApp — o onboarding já começou.</p>` +
      `</body></html>`
    );
  }
}
