import { Injectable } from '@nestjs/common';
import { Language } from '@vesteai/shared';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * ReferralService — programa de indicação.
 *  - getOrCreateCode: gera (idempotente) um código para o usuário convidar.
 *  - redeem: aplica um código quando um novo assinante o usa, marcando a
 *    recompensa pendente para o indicador.
 */
@Injectable()
export class ReferralService {
  constructor(private readonly prisma: PrismaService) {}

  /** Código de indicação do usuário (cria no primeiro uso). */
  async getOrCreateCode(userId: string, lang: Language): Promise<string> {
    const existing = await this.prisma.referral.findFirst({
      where: { referrerId: userId, referredId: null },
    });
    if (existing) return existing.code;

    const code = this.generateCode();
    await this.prisma.referral.create({
      data: { referrerId: userId, code },
    });
    return code;
  }

  /** Mensagem pronta com o código + convite. */
  async invitationMessage(userId: string, lang: Language): Promise<string> {
    const code = await this.getOrCreateCode(userId, lang);
    return lang === Language.EN
      ? `Share VesteAI and earn rewards! 🎁 Your code: *${code}*. When a friend subscribes using it, you both get a perk.`
      : `Indique o VesteAI e ganhe recompensas! 🎁 Seu código: *${code}*. Quando um amigo assinar usando ele, vocês dois ganham um bônus.`;
  }

  /**
   * Resgata um código para um novo usuário (chamado na ativação da
   * assinatura, se o lead trouxe um código). Idempotente por referredId.
   */
  async redeem(code: string, newUserId: string): Promise<boolean> {
    const ref = await this.prisma.referral.findUnique({ where: { code } });
    if (!ref) return false;
    if (ref.referrerId === newUserId) return false; // não auto-indica
    if (ref.referredId) return false; // já resgatado

    await this.prisma.referral.update({
      where: { id: ref.id },
      data: { referredId: newUserId, rewarded: true },
    });
    return true;
  }

  private generateCode(): string {
    return 'VESTE' + randomBytes(3).toString('hex').toUpperCase();
  }
}
