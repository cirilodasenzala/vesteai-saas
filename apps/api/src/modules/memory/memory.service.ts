import { Injectable } from '@nestjs/common';
import { Language, Sex, Style } from '@vesteai/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import type { UserMemorySnapshot } from '../../core/ports/ai-stylist.provider';

/**
 * MemoryService — memória permanente do usuário.
 * Centraliza leitura/escrita do perfil + fatos, com cifra de PII (nome).
 * "Nunca perguntar de novo": os módulos consultam aqui o que já se sabe.
 */
@Injectable()
export class MemoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  /** Cria usuário + memória vazia (idempotente por número). */
  async ensureUser(whatsappNumber: string) {
    const existing = await this.prisma.user.findUnique({
      where: { whatsappNumber },
    });
    if (existing) return existing;

    return this.prisma.user.create({
      data: {
        whatsappNumber,
        memory: { create: {} },
      },
    });
  }

  async findByNumber(whatsappNumber: string) {
    return this.prisma.user.findUnique({
      where: { whatsappNumber },
      include: { memory: true, subscription: true },
    });
  }

  /** Atualiza campos do perfil. Cifra o nome antes de persistir. */
  async updateProfile(
    userId: string,
    data: {
      name?: string;
      age?: number;
      sex?: Sex;
      favoriteStyle?: Style;
      favoriteColors?: string[];
      heightCm?: number;
      weightKg?: number;
      language?: Language;
    },
  ) {
    const patch: Record<string, unknown> = { ...data };
    if (data.name !== undefined) {
      patch.name = this.crypto.encrypt(data.name);
    }
    return this.prisma.user.update({ where: { id: userId }, data: patch });
  }

  /** Atualiza o idioma detectado (chamado a cada mensagem). */
  async setLanguage(userId: string, language: Language): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { language },
    });
  }

  /** Monta um snapshot para alimentar o LLM (nome decifrado). */
  async snapshot(userId: string): Promise<UserMemorySnapshot> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { memory: true },
    });
    if (!user) {
      return { language: Language.PT };
    }
    return {
      name: this.crypto.decrypt(user.name),
      age: user.age,
      sex: user.sex,
      language: user.language as unknown as Language,
      favoriteStyle: user.favoriteStyle,
      favoriteColors: user.favoriteColors,
      summary: user.memory?.summary ?? null,
    };
  }
}
