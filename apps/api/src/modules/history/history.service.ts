import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * HistoryService — consultas do histórico do usuário (roupas experimentadas,
 * datas, eventos, looks gerados). Usado pelo admin e por features futuras.
 */
@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Histórico completo de um usuário, mais recente primeiro. */
  async forUser(userId: string, take = 50) {
    return this.prisma.history.findMany({
      where: { userId },
      take,
      orderBy: { triedAt: 'desc' },
      include: {
        look: {
          select: { description: true, items: true, score: true, eventId: true },
        },
      },
    });
  }

  /** Looks gerados de um usuário. */
  async looksForUser(userId: string, take = 50) {
    return this.prisma.look.findMany({
      where: { userId },
      take,
      orderBy: { createdAt: 'desc' },
      include: { event: { select: { type: true, whenAt: true } } },
    });
  }
}
