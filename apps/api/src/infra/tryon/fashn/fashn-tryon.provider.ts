import { Inject, Injectable, Logger } from '@nestjs/common';
import { TryOnStatus } from '@vesteai/shared';
import type { AppConfig } from '../../../config/config.module';
import {
  TryOnInput,
  TryOnProvider,
  TryOnResult,
} from '../../../core/ports/tryon.provider';

/**
 * Provador via FASHN AI (assíncrono). Inicia o job em /run e o status é
 * consultado em /status/:id pelo processor da fila (polling com backoff).
 *
 * Mantém rosto/corpo/proporções/postura/expressão; troca apenas a roupa.
 * Selecionado quando FASHN_API_KEY está presente.
 */
@Injectable()
export class FashnTryOnProvider extends TryOnProvider {
  readonly driver = 'fashn';
  private readonly logger = new Logger(FashnTryOnProvider.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(@Inject('APP_CONFIG') config: AppConfig) {
    super();
    if (!config.FASHN_API_KEY) {
      throw new Error('FashnTryOnProvider requer FASHN_API_KEY.');
    }
    this.apiKey = config.FASHN_API_KEY;
    this.baseUrl = config.FASHN_BASE_URL.replace(/\/$/, '');
  }

  async generate(input: TryOnInput): Promise<TryOnResult> {
    try {
      const res = await fetch(`${this.baseUrl}/run`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_name: 'tryon-v1.6',
          inputs: {
            model_image: input.bodyImageUrl,
            garment_image: input.garmentImageUrl,
            category: input.category ?? 'auto',
          },
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`FASHN /run ${res.status}: ${text}`);
        return { status: TryOnStatus.FAILED, error: `FASHN /run ${res.status}` };
      }
      const data = (await res.json()) as { id?: string };
      return {
        status: TryOnStatus.PROCESSING,
        providerJobId: data.id,
      };
    } catch (err) {
      this.logger.error('Falha ao iniciar job FASHN.', err as Error);
      return { status: TryOnStatus.FAILED, error: (err as Error).message };
    }
  }

  async getStatus(providerJobId: string): Promise<TryOnResult> {
    try {
      const res = await fetch(`${this.baseUrl}/status/${providerJobId}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!res.ok) {
        return {
          status: TryOnStatus.FAILED,
          providerJobId,
          error: `FASHN /status ${res.status}`,
        };
      }
      const data = (await res.json()) as {
        status?: string;
        output?: string[] | string;
        error?: string;
      };

      // FASHN: status pode ser 'starting'|'in_queue'|'processing'|'completed'|'failed'
      if (data.status === 'completed') {
        const url = Array.isArray(data.output) ? data.output[0] : data.output;
        return { status: TryOnStatus.DONE, providerJobId, imageUrl: url };
      }
      if (data.status === 'failed') {
        return {
          status: TryOnStatus.FAILED,
          providerJobId,
          error: data.error ?? 'failed',
        };
      }
      return { status: TryOnStatus.PROCESSING, providerJobId };
    } catch (err) {
      return {
        status: TryOnStatus.FAILED,
        providerJobId,
        error: (err as Error).message,
      };
    }
  }
}
