import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AppConfig } from '../../config/config.module';

/**
 * WhatsappSender — envia mensagens via Evolution API.
 *  - sendText  -> POST {base}/message/sendText/{instance}
 *  - sendImage -> POST {base}/message/sendMedia/{instance}
 * Header de auth: `apikey: <EVOLUTION_API_KEY>`.
 *
 * Se EVOLUTION_BASE_URL/API_KEY/INSTANCE não estiverem configurados, opera
 * em modo SIMULADO (apenas loga) — permite rodar o fluxo localmente sem a VPS.
 *
 * A mídia recebida do usuário NÃO é baixada via rede: ela chega em base64 no
 * próprio webhook (webhookBase64). O helper decodeMedia converte para Buffer.
 */
@Injectable()
export class WhatsappSender {
  private readonly logger = new Logger(WhatsappSender.name);
  private readonly baseUrl?: string;
  private readonly apiKey?: string;
  private readonly instance?: string;
  private readonly simulated: boolean;

  constructor(@Inject('APP_CONFIG') private readonly config: AppConfig) {
    this.baseUrl = config.EVOLUTION_BASE_URL?.replace(/\/$/, '');
    this.apiKey = config.EVOLUTION_API_KEY;
    this.instance = config.EVOLUTION_INSTANCE;
    this.simulated = !this.baseUrl || !this.apiKey || !this.instance;

    if (this.simulated) {
      this.logger.warn(
        'WhatsApp (Evolution) em modo SIMULADO — defina EVOLUTION_BASE_URL/API_KEY/INSTANCE.',
      );
    }
  }

  /** Envia uma mensagem de texto. `to` = número só com dígitos (5511...). */
  async sendText(to: string, body: string): Promise<void> {
    await this.post('sendText', { number: this.normalize(to), text: body });
  }

  /** Envia uma imagem por URL pública (ex.: resultado do provador). */
  async sendImage(to: string, imageUrl: string, caption?: string): Promise<void> {
    await this.post('sendMedia', {
      number: this.normalize(to),
      mediatype: 'image',
      media: imageUrl,
      caption,
    });
  }

  /**
   * Envia uma imagem a partir dos bytes (base64) — não depende de URL pública
   * acessível pela Evolution. Mais robusto para entregar o resultado do provador.
   */
  async sendImageBytes(
    to: string,
    bytes: Buffer,
    caption?: string,
  ): Promise<void> {
    await this.post('sendMedia', {
      number: this.normalize(to),
      mediatype: 'image',
      media: bytes.toString('base64'),
      fileName: 'provador.jpg',
      caption,
    });
  }

  /**
   * Decodifica a mídia recebida (base64 do webhook) para Buffer.
   * Retorna null se não houver base64 (modo dev/simulado usa placeholder).
   */
  decodeMedia(mediaBase64?: string): { buffer: Buffer; mime: string } | null {
    if (!mediaBase64) return null;
    try {
      // Aceita tanto "data:image/...;base64,XXXX" quanto só o conteúdo.
      const comma = mediaBase64.indexOf(',');
      const raw = mediaBase64.startsWith('data:') && comma >= 0
        ? mediaBase64.slice(comma + 1)
        : mediaBase64;
      const buffer = Buffer.from(raw, 'base64');
      if (buffer.length === 0) return null;
      return { buffer, mime: 'image/jpeg' };
    } catch (err) {
      this.logger.warn(`Falha ao decodificar mídia base64: ${(err as Error).message}`);
      return null;
    }
  }

  private normalize(to: string): string {
    return to.replace(/\D/g, '');
  }

  private async post(endpoint: string, payload: Record<string, unknown>): Promise<void> {
    if (this.simulated) {
      this.logger.log(`[SIMULADO] ${endpoint} -> ${JSON.stringify(payload)}`);
      return;
    }

    const url = `${this.baseUrl}/message/${endpoint}/${this.instance}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          apikey: this.apiKey as string,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.error(
          `Falha Evolution ${endpoint} (${res.status}) p/ ${payload.number}: ${text}`,
        );
      }
    } catch (err) {
      this.logger.error(`Erro de rede Evolution ${endpoint}`, err as Error);
    }
  }
}
