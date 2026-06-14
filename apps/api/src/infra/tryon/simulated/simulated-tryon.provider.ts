import { Injectable, Logger } from '@nestjs/common';
import { TryOnStatus } from '@vesteai/shared';
import {
  TryOnInput,
  TryOnProvider,
  TryOnResult,
} from '../../../core/ports/tryon.provider';

/**
 * Provador SIMULADO (sem FASHN). Resolve instantaneamente devolvendo a
 * própria URL da foto do corpo como "resultado" — suficiente para exercitar
 * toda a rota fila → storage → entrega no WhatsApp sem chave externa.
 */
@Injectable()
export class SimulatedTryOnProvider extends TryOnProvider {
  readonly driver = 'simulated';
  private readonly logger = new Logger(SimulatedTryOnProvider.name);

  async generate(input: TryOnInput): Promise<TryOnResult> {
    this.logger.log('[SIMULADO] Gerando provador (retorna a foto do corpo).');
    return {
      status: TryOnStatus.DONE,
      providerJobId: `sim_${Date.now()}`,
      imageUrl: input.bodyImageUrl,
    };
  }

  async getStatus(providerJobId: string): Promise<TryOnResult> {
    return { status: TryOnStatus.DONE, providerJobId };
  }
}
