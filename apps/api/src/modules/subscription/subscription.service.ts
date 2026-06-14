import { Injectable, Logger } from '@nestjs/common';
import { SubStatus, PREMIUM_PLAN_CODE } from '@vesteai/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { MemoryService } from '../memory/memory.service';
import type { PaymentEvent } from '../../core/ports/payment.provider';

/**
 * SubscriptionService — fonte da verdade sobre acesso pago.
 * Aplica eventos de pagamento (checkout/renovação/cancelamento) e
 * expõe a checagem de assinatura ativa usada na verificação do número.
 */
@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly memory: MemoryService,
  ) {}

  /** Há assinatura ativa para este número? */
  async hasActiveSubscription(whatsappNumber: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { whatsappNumber },
      include: { subscription: true },
    });
    const sub = user?.subscription;
    if (!sub) return false;
    if (sub.status !== SubStatus.ACTIVE) return false;
    if (sub.currentPeriodEnd && sub.currentPeriodEnd < new Date()) return false;
    return true;
  }

  /**
   * Aplica um evento de pagamento. Retorna o userId afetado (quando
   * possível) para o caller iniciar o onboarding.
   * Idempotente por externalEventId (registra Payment).
   */
  async applyPaymentEvent(event: PaymentEvent): Promise<{ userId?: string }> {
    // Idempotência: ignora eventos já processados.
    if (event.externalEventId) {
      const seen = await this.prisma.payment.findUnique({
        where: { externalId: event.externalEventId },
      });
      if (seen) {
        this.logger.debug(`Evento de pagamento duplicado: ${event.externalEventId}`);
        return { userId: seen.userId ?? undefined };
      }
    }

    switch (event.type) {
      case 'CHECKOUT_COMPLETED':
        return this.activate(event);
      case 'SUBSCRIPTION_RENEWED':
        await this.renew(event);
        return {};
      case 'SUBSCRIPTION_CANCELED':
        await this.cancel(event);
        return {};
      case 'PAYMENT_FAILED':
        await this.markPastDue(event);
        return {};
      default:
        return {};
    }
  }

  private async activate(event: PaymentEvent): Promise<{ userId?: string }> {
    if (!event.whatsappNumber) {
      this.logger.warn('CHECKOUT_COMPLETED sem whatsappNumber — ignorado.');
      return {};
    }

    const user = await this.memory.ensureUser(event.whatsappNumber);

    await this.prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        status: SubStatus.ACTIVE,
        plan: PREMIUM_PLAN_CODE,
        externalCustomerId: event.externalCustomerId,
        externalSubId: event.externalSubId,
        currentPeriodEnd: event.currentPeriodEnd,
      },
      update: {
        status: SubStatus.ACTIVE,
        externalCustomerId: event.externalCustomerId,
        externalSubId: event.externalSubId,
        currentPeriodEnd: event.currentPeriodEnd,
        canceledAt: null,
      },
    });

    await this.recordPayment(event, user.id);
    this.logger.log(`Assinatura ATIVADA para ${event.whatsappNumber}`);
    return { userId: user.id };
  }

  private async renew(event: PaymentEvent): Promise<void> {
    const sub = await this.findByExternal(event);
    if (!sub) return;
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: SubStatus.ACTIVE,
        currentPeriodEnd: event.currentPeriodEnd ?? sub.currentPeriodEnd,
      },
    });
    await this.recordPayment(event, sub.userId);
  }

  private async cancel(event: PaymentEvent): Promise<void> {
    const sub = await this.findByExternal(event);
    if (!sub) return;
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: SubStatus.CANCELED, canceledAt: new Date() },
    });
    await this.recordPayment(event, sub.userId);
  }

  private async markPastDue(event: PaymentEvent): Promise<void> {
    const sub = await this.findByExternal(event);
    if (!sub) return;
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: SubStatus.PAST_DUE },
    });
    await this.recordPayment(event, sub.userId);
  }

  private async findByExternal(event: PaymentEvent) {
    if (event.externalSubId) {
      const bySub = await this.prisma.subscription.findFirst({
        where: { externalSubId: event.externalSubId },
      });
      if (bySub) return bySub;
    }
    if (event.externalCustomerId) {
      return this.prisma.subscription.findFirst({
        where: { externalCustomerId: event.externalCustomerId },
      });
    }
    return null;
  }

  private async recordPayment(event: PaymentEvent, userId?: string): Promise<void> {
    if (!event.externalEventId) return;
    await this.prisma.payment.upsert({
      where: { externalId: event.externalEventId },
      create: {
        externalId: event.externalEventId,
        userId,
        amount: event.amount,
        currency: event.currency,
        status: event.type,
        raw: (event.raw as object) ?? undefined,
      },
      update: {},
    });
  }
}
