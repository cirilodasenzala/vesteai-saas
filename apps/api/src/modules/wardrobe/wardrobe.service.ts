import { Injectable } from '@nestjs/common';
import { ConvState, Language, MsgType } from '@vesteai/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageProvider } from '../../core/ports/storage.provider';
import { MemoryService } from '../memory/memory.service';
import { WhatsappSender } from '../whatsapp/whatsapp-sender.service';
import { AIStylistProvider } from '../../core/ports/ai-stylist.provider';
import { validateImage } from '../../common/pipes/image-validation';
import type { InboundMessage } from '../whatsapp/whatsapp.types';

/**
 * WardrobeService — guarda-roupa do usuário.
 *  - intake: usuário envia várias peças (fotos) até dizer "pronto".
 *  - uso: "monte um look com minhas roupas" -> stylist combina os itens.
 */

export interface WardrobeStepResult {
  reply: string;
  state: ConvState;
}

@Injectable()
export class WardrobeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageProvider,
    private readonly sender: WhatsappSender,
    private readonly memory: MemoryService,
    private readonly stylist: AIStylistProvider,
  ) {}

  /** Entra no modo de cadastro de peças. */
  startIntake(lang: Language): WardrobeStepResult {
    return {
      reply:
        lang === Language.EN
          ? 'Send me photos of your clothes one by one. When you’re done, type "done". 🧥'
          : 'Me envie fotos das suas roupas, uma por uma. Quando terminar, digite "pronto". 🧥',
      state: ConvState.WARDROBE_INTAKE,
    };
  }

  /** Recebe peças durante o intake; "pronto/done" finaliza. */
  async handleIntake(
    userId: string,
    lang: Language,
    msg: InboundMessage,
  ): Promise<WardrobeStepResult> {
    const text = (msg.text ?? '').trim().toLowerCase();
    if (/^(pronto|done|finish|terminei|acabou)$/.test(text)) {
      const count = await this.prisma.wardrobeItem.count({ where: { userId } });
      return {
        reply:
          lang === Language.EN
            ? `Great — your wardrobe has ${count} item(s)! Say "build a look with my clothes" whenever you like. ✨`
            : `Pronto — seu guarda-roupa tem ${count} peça(s)! Diga "monte um look com minhas roupas" quando quiser. ✨`,
        state: ConvState.IDLE,
      };
    }

    if (msg.type === MsgType.IMAGE) {
      const media = this.sender.decodeMedia(msg.mediaBase64);
      let photoKey: string | undefined;
      if (media && validateImage(media.buffer).ok) {
        const key = `users/${userId}/wardrobe/${Date.now()}.jpg`;
        const stored = await this.storage.put(key, media.buffer, media.mime);
        photoKey = stored.key;
      }
      await this.prisma.wardrobeItem.create({
        data: {
          userId,
          category: this.guessCategory(msg.text),
          photoKey,
          attrs: msg.text ? { note: msg.text } : undefined,
        },
      });
      return {
        reply:
          lang === Language.EN
            ? 'Saved! Send another, or type "done".'
            : 'Salvei! Envie outra, ou digite "pronto".',
        state: ConvState.WARDROBE_INTAKE,
      };
    }

    return {
      reply:
        lang === Language.EN
          ? 'Send a photo of the item, or type "done" to finish.'
          : 'Envie a foto da peça, ou digite "pronto" para finalizar.',
      state: ConvState.WARDROBE_INTAKE,
    };
  }

  /** Monta um look usando as peças já cadastradas. */
  async buildFromWardrobe(userId: string, lang: Language): Promise<string> {
    const items = await this.prisma.wardrobeItem.findMany({
      where: { userId },
      take: 50,
    });
    if (items.length === 0) {
      return lang === Language.EN
        ? 'Your wardrobe is empty — send me some clothes first! Type "add clothes". 🧥'
        : 'Seu guarda-roupa está vazio — me envie algumas roupas antes! Digite "cadastrar roupas". 🧥';
    }

    const snapshot = await this.memory.snapshot(userId);
    const list = items
      .map((i) => `${i.category}${i.color ? ` ${i.color}` : ''}`)
      .join(', ');

    const reply = await this.stylist.reply({
      text:
        (lang === Language.EN
          ? 'Build a complete outfit using ONLY these wardrobe items, explaining why it works: '
          : 'Monte um look completo usando APENAS estas peças do meu guarda-roupa, explicando o porquê: ') +
        list,
      memory: snapshot,
    });
    return reply.text;
  }

  private guessCategory(text?: string): string {
    const t = (text ?? '').toLowerCase();
    if (/(calça|pants|jeans|short|bermuda)/.test(t)) return 'bottom';
    if (/(tênis|tenis|sapato|shoe|bota|boot)/.test(t)) return 'shoes';
    if (/(jaqueta|casaco|blazer|jacket|coat)/.test(t)) return 'outerwear';
    if (/(relógio|colar|cinto|watch|belt|accessor)/.test(t)) return 'accessory';
    return 'top';
  }
}
