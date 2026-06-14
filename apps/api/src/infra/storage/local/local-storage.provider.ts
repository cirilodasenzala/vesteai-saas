import { Inject, Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import type { AppConfig } from '../../../config/config.module';
import { PutResult, StorageProvider } from '../../../core/ports/storage.provider';

/**
 * Armazenamento LOCAL (dev sem MinIO). Grava em ./.storage e serve as
 * imagens via GET /files/:key (LocalFilesController). Para o WhatsApp
 * conseguir baixar a imagem do provador, APP_BASE_URL precisa ser
 * publicamente acessível (ex.: túnel) em produção — em dev o sender é
 * simulado e apenas loga a URL.
 */
@Injectable()
export class LocalStorageProvider extends StorageProvider {
  readonly driver = 'local';
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly root: string;
  private readonly baseUrl: string;

  constructor(@Inject('APP_CONFIG') config: AppConfig) {
    super();
    this.root = join(process.cwd(), '.storage');
    this.baseUrl = config.APP_BASE_URL;
  }

  async put(key: string, body: Buffer): Promise<PutResult> {
    const path = join(this.root, key);
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, body);
    return { key, url: `${this.baseUrl}/files/${encodeURIComponent(key)}` };
  }

  async getUrl(key: string): Promise<string> {
    return `${this.baseUrl}/files/${encodeURIComponent(key)}`;
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(join(this.root, key));
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(join(this.root, key));
    } catch (err) {
      this.logger.warn(`Falha ao remover ${key}: ${(err as Error).message}`);
    }
  }
}
