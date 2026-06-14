import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AppConfig } from '../../config/config.module';
import { StorageProvider } from '../../core/ports/storage.provider';

/**
 * Serve imagens do LocalStorageProvider (dev). Só ativo quando
 * STORAGE_DRIVER=local. Com S3/MinIO as URLs apontam direto pro bucket.
 */
@Controller('files')
export class LocalFilesController {
  constructor(
    @Inject('APP_CONFIG') private readonly config: AppConfig,
    private readonly storage: StorageProvider,
  ) {}

  @Get(':key')
  async serve(@Param('key') key: string, @Res() res: Response): Promise<void> {
    if (this.config.STORAGE_DRIVER !== 'local') {
      throw new NotFoundException();
    }
    try {
      const buf = await this.storage.get(decodeURIComponent(key));
      res.setHeader('Content-Type', 'image/jpeg');
      res.send(buf);
    } catch {
      throw new NotFoundException('Arquivo não encontrado.');
    }
  }
}
