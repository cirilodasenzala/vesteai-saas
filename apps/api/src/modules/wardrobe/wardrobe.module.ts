import { Module } from '@nestjs/common';
import { WardrobeService } from './wardrobe.service';

/**
 * WardrobeModule — guarda-roupa. StorageProvider/AIStylistProvider vêm do
 * ProvidersModule (@Global); MemoryService do MemoryModule (@Global);
 * WhatsappSender do WhatsappSenderModule (@Global).
 */
@Module({
  providers: [WardrobeService],
  exports: [WardrobeService],
})
export class WardrobeModule {}
