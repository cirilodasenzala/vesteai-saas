import { Injectable } from '@nestjs/common';
import { SubStatus, TryOnStatus } from '@vesteai/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * AdminService — agrega as métricas do painel administrativo.
 * Tudo derivado do banco; sem efeitos colaterais.
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** Visão geral (cards do dashboard). */
  async overview() {
    const [
      users,
      activeSubs,
      canceledSubs,
      pastDueSubs,
      messages,
      generatedImages,
      tryOnDone,
      tryOnFailed,
      events,
      wardrobeItems,
      payments,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.subscription.count({ where: { status: SubStatus.ACTIVE } }),
      this.prisma.subscription.count({ where: { status: SubStatus.CANCELED } }),
      this.prisma.subscription.count({ where: { status: SubStatus.PAST_DUE } }),
      this.prisma.message.count(),
      this.prisma.photo.count({ where: { kind: 'RESULT' } }),
      this.prisma.tryOnJob.count({ where: { status: TryOnStatus.DONE } }),
      this.prisma.tryOnJob.count({ where: { status: TryOnStatus.FAILED } }),
      this.prisma.event.count(),
      this.prisma.wardrobeItem.count(),
      this.prisma.payment.findMany({
        where: { status: { in: ['CHECKOUT_COMPLETED', 'SUBSCRIPTION_RENEWED'] } },
        select: { amount: true, currency: true },
      }),
    ]);

    // Receita aproximada (soma dos pagamentos confirmados/renovações).
    const revenueCents = payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);

    return {
      users,
      subscriptions: {
        active: activeSubs,
        canceled: canceledSubs,
        pastDue: pastDueSubs,
      },
      revenue: {
        cents: revenueCents,
        formatted: this.formatBRL(revenueCents),
      },
      engagement: {
        messages,
        generatedImages,
        events,
        wardrobeItems,
      },
      tryOn: { done: tryOnDone, failed: tryOnFailed },
    };
  }

  /** Lista paginada de usuários (sem PII sensível em claro). */
  async listUsers(skip = 0, take = 25) {
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          whatsappNumber: true,
          language: true,
          favoriteStyle: true,
          createdAt: true,
          subscription: { select: { status: true, currentPeriodEnd: true } },
        },
      }),
      this.prisma.user.count(),
    ]);
    return { total, items };
  }

  /** Logs recentes (auditoria/observabilidade). */
  async recentLogs(scope?: string, take = 50) {
    return this.prisma.appLog.findMany({
      where: scope ? { scope } : undefined,
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  /** Conversas recentes (suporte). */
  async recentConversations(take = 25) {
    return this.prisma.conversation.findMany({
      take,
      orderBy: { lastMessageAt: 'desc' },
      select: {
        id: true,
        whatsappNumber: true,
        state: true,
        lastMessageAt: true,
        _count: { select: { messages: true } },
      },
    });
  }

  private formatBRL(cents: number): string {
    return (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }
}
