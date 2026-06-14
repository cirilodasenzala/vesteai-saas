/**
 * Porta (interface) de armazenamento de objetos (imagens).
 * Implementações: S3Provider (S3/MinIO) e LocalProvider (./.storage).
 * Selecionada por STORAGE_DRIVER no composition root.
 */

export interface PutResult {
  key: string;
  /** URL acessível (pública ou assinada) para a imagem. */
  url: string;
}

export abstract class StorageProvider {
  abstract readonly driver: string;

  /** Salva um objeto e retorna sua chave + URL. */
  abstract put(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<PutResult>;

  /** URL acessível para uma chave já existente (assinada quando aplicável). */
  abstract getUrl(key: string, ttlSec?: number): Promise<string>;

  /** Baixa o conteúdo de uma chave (para reenvio/processamento). */
  abstract get(key: string): Promise<Buffer>;

  /** Remove um objeto (LGPD / limpeza). */
  abstract delete(key: string): Promise<void>;
}
