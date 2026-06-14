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

  private static readonly DEFAULT_BASE = 'https://api.fashn.ai/v1';

  constructor(@Inject('APP_CONFIG') config: AppConfig) {
    super();
    if (!config.FASHN_API_KEY) {
      throw new Error('FashnTryOnProvider requer FASHN_API_KEY.');
    }
    this.apiKey = config.FASHN_API_KEY;
    // Sanitiza: remove barras finais; se vazio/sem host, usa o default.
    // (env vazia no painel NÃO aciona o default do zod, então tratamos aqui.)
    const base = (config.FASHN_BASE_URL || '').trim().replace(/\/+$/, '');
    this.baseUrl = base.startsWith('http')
      ? base
      : FashnTryOnProvider.DEFAULT_BASE;
    this.logger.log(`FASHN baseUrl = ${this.baseUrl}`);
  }

  async generate(input: TryOnInput): Promise<TryOnResult> {
    const url = `${this.baseUrl}/run`;
    try {
      const res = await fetch(url, {
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
        this.logger.error(`FASHN POST ${url} -> ${res.status}: ${text}`);
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
        error?: unknown;
      };

      // FASHN: status pode ser 'starting'|'in_queue'|'processing'|'completed'|'failed'
      if (data.status === 'completed') {
        const out = Array.isArray(data.output) ? data.output[0] : data.output;
        return { status: TryOnStatus.DONE, providerJobId, imageUrl: out };
      }
      if (data.status === 'failed') {
        // O error do FASHN pode ser objeto ({ name, message }) ou string.
        const errMsg =
          typeof data.error === 'string'
            ? data.error
            : data.error
              ? JSON.stringify(data.error)
              : 'failed';
        this.logger.error(`FASHN job ${providerJobId} falhou: ${errMsg}`);
        return { status: TryOnStatus.FAILED, providerJobId, error: errMsg };
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
