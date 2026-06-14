import { Module } from '@nestjs/common';
import { LocalFilesController } from './local-files.controller';

/**
 * StorageModule — expõe GET /files/:key para o LocalStorageProvider (dev).
 * O StorageProvider em si vem do ProvidersModule (@Global).
 */
@Module({
  controllers: [LocalFilesController],
})
export class StorageModule {}
