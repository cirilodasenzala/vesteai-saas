import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'crypto';
import type { AppConfig } from '../../config/config.module';

/**
 * CryptoService — cifra/decifra PII (nome, etc.) com AES-256-GCM.
 *
 * Formato do texto cifrado: base64(iv).base64(authTag).base64(ciphertext)
 * Se PII_ENCRYPTION_KEY não estiver configurada, opera em modo
 * passthrough (sem cifrar) e avisa — útil em dev, NUNCA em produção.
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly key: Buffer | null;
  private readonly algorithm = 'aes-256-gcm';

  constructor(@Inject('APP_CONFIG') config: AppConfig) {
    if (config.PII_ENCRYPTION_KEY) {
      const buf = Buffer.from(config.PII_ENCRYPTION_KEY, 'base64');
      if (buf.length !== 32) {
        throw new Error(
          'PII_ENCRYPTION_KEY deve ser 32 bytes em base64 (AES-256).',
        );
      }
      this.key = buf;
    } else {
      this.key = null;
      if (config.NODE_ENV === 'production') {
        throw new Error(
          'PII_ENCRYPTION_KEY é obrigatória em produção (LGPD).',
        );
      }
      this.logger.warn(
        'PII_ENCRYPTION_KEY ausente — PII NÃO será cifrada (apenas dev).',
      );
    }
  }

  encrypt(plain: string | null | undefined): string | null {
    if (plain == null) return null;
    if (!this.key) return plain;
    const iv = randomBytes(12);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
  }

  decrypt(payload: string | null | undefined): string | null {
    if (payload == null) return null;
    if (!this.key) return payload;
    const parts = payload.split('.');
    if (parts.length !== 3) return payload; // não cifrado (dado legado)
    const [ivB64, tagB64, dataB64] = parts;
    try {
      const decipher = createDecipheriv(
        this.algorithm,
        this.key,
        Buffer.from(ivB64, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
      const dec = Buffer.concat([
        decipher.update(Buffer.from(dataB64, 'base64')),
        decipher.final(),
      ]);
      return dec.toString('utf8');
    } catch (err) {
      this.logger.error('Falha ao decifrar PII.', err as Error);
      return null;
    }
  }
}
