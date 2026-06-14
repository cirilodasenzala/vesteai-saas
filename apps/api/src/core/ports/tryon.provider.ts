import { TryOnStatus } from '@vesteai/shared';

/**
 * Porta (interface) do provador virtual.
 * Implementações: FashnProvider (real) e SimulatedTryOnProvider.
 * Selecionada pela presença de FASHN_API_KEY.
 */

export interface TryOnInput {
  /** URL pública da foto do corpo inteiro. */
  bodyImageUrl: string;
  /** URL pública da foto da roupa. */
  garmentImageUrl: string;
  /** Categoria opcional da peça (tops, bottoms, one-pieces...). */
  category?: string;
}

export interface TryOnResult {
  status: TryOnStatus;
  /** Id do job no provedor (para polling assíncrono). */
  providerJobId?: string;
  /** URL da imagem resultante (quando já disponível). */
  imageUrl?: string;
  error?: string;
}

export abstract class TryOnProvider {
  abstract readonly driver: string;

  /** Inicia a geração. Pode retornar DONE (simulado) ou PROCESSING (FASHN). */
  abstract generate(input: TryOnInput): Promise<TryOnResult>;

  /** Consulta o status de um job assíncrono (FASHN). */
  abstract getStatus(providerJobId: string): Promise<TryOnResult>;
}
