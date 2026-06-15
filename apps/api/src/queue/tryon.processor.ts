import { Injectable, Logger } from '@nestjs/common';
import { ConvState, MsgDirection, MsgType, TryOnStatus } from '@vesteai/shared';
import { PrismaService } from '../infra/prisma/prisma.service';
import { StorageProvider } from '../core/ports/storage.provider';
import { TryOnProvider } from '../core/ports/tryon.provider';
import { WhatsappSender } from '../modules/whatsapp/whatsapp-sender.service';
import type { TryOnJobData } from './tryon.types';

/**
 * TryOnProcessor — núcleo do processamento do provador (compartilhado entre
 * a fila Redis e o modo memória):
 *   gerar -> (poll se FASHN) -> baixar resultado -> salvar no storage ->
 *   Photo(RESULT) + History -> entregar imagem no WhatsApp -> "outra peça?".
 */
@Injectable()
export class TryOnProcessor {
  private readonly logger = new Logger(TryOnProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageProvider,
    private readonly tryon: TryOnProvider,
    private readonly sender: WhatsappSender,
  ) {}

  async process(data: TryOnJobData): Promise<void> {
    await this.prisma.tryOnJob.update({
      where: { id: data.tryOnJobId },
      data: { status: TryOnStatus.PROCESSING },
    });

    try {
      const bodyUrl = await this.storage.getUrl(data.bodyKey);
      const garmentUrl = await this.storage.getUrl(data.garmentKey);

      let result = await this.tryon.generate({
        bodyImageUrl: bodyUrl,
        garmentImageUrl: garmentUrl,
      });

      // Polling para provedores assíncronos (FASHN).
      if (result.status === TryOnStatus.PROCESSING && result.providerJobId) {
        result = await this.poll(result.providerJobId);
      }

      if (result.status !== TryOnStatus.DONE || !result.imageUrl) {
        return this.fail(data, result.error ?? 'sem imagem');
      }

      // Persiste o resultado no nosso storage (estável e nosso domínio).
      const resultKey = `users/${data.userId}/results/${data.tryOnJobId}.jpg`;
      const bytes = await this.fetchBytes(result.imageUrl);
      const stored = bytes
        ? await this.storage.put(resultKey, bytes, 'image/jpeg')
        : { key: resultKey, url: result.imageUrl };

      await this.prisma.$transaction([
        this.prisma.tryOnJob.update({
          where: { id: data.tryOnJobId },
          data: { status: TryOnStatus.DONE, resultPhotoKey: stored.key },
        }),
        this.prisma.photo.create({
          data: { userId: data.userId, kind: 'RESULT', storageKey: stored.key },
        }),
        this.prisma.history.create({
          data: { userId: data.userId, resultPhotoKey: stored.key },
        }),
      ]);

      // Entrega o resultado: por bytes (base64) quando temos os bytes — não
      // depende de URL pública acessível pela Evolution; senão, por URL.
      if (bytes) {
        await this.sender.sendImageBytes(
          data.whatsappNumber,
          bytes,
          'Aqui está o seu provador ✨',
        );
      } else {
        await this.sender.sendImage(
          data.whatsappNumber,
          result.imageUrl!,
          'Aqui está o seu provador ✨',
        );
      }
      await this.ask(data, 'Quer experimentar outra peça? 👗 (sim/não)');
      // Pronto para a próxima peça.
      await this.prisma.conversation.update({
        where: { id: data.conversationId },
        data: { state: ConvState.TRYON_GARMENT },
      });
    } catch (err) {
      this.logger.error(`Falha no provador ${data.tryOnJobId}`, err as Error);
      await this.fail(data, (err as Error).message);
    }
  }

  private async poll(providerJobId: string): Promise<{
    status: TryOnStatus;
    imageUrl?: string;
    error?: string;
    providerJobId?: string;
  }> {
    const delays = [2000, 3000, 4000, 5000, 6000, 8000, 10000]; // backoff
    for (const ms of delays) {
      await new Promise((r) => setTimeout(r, ms));
      const status = await this.tryon.getStatus(providerJobId);
      if (status.status === TryOnStatus.DONE) return status;
      if (status.status === TryOnStatus.FAILED) return status;
    }
    return { status: TryOnStatus.FAILED, error: 'timeout', providerJobId };
  }

  private async fetchBytes(url: string): Promise<Buffer | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  private async fail(data: TryOnJobData, error: string): Promise<void> {
    await this.prisma.tryOnJob.update({
      where: { id: data.tryOnJobId },
      data: { status: TryOnStatus.FAILED, error },
    });
    await this.ask(
      data,
      'Tive um contratempo gerando seu provador 😔 Vamos tentar de novo? Envie a roupa novamente.',
    );
    await this.prisma.conversation.update({
      where: { id: data.conversationId },
      data: { state: ConvState.TRYON_GARMENT },
    });
  }

  private async ask(data: TryOnJobData, body: string): Promise<void> {
    await this.sender.sendText(data.whatsappNumber, body);
    await this.prisma.message.create({
      data: {
        conversationId: data.conversationId,
        direction: MsgDirection.OUTBOUND,
        type: MsgType.TEXT,
        body,
      },
    });
  }
}
