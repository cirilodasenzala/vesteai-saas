import { Module } from '@nestjs/common';
import { DevController } from './dev.controller';
import { ConversationModule } from '../conversation/conversation.module';

/**
 * Módulo de utilidades de desenvolvimento. O controller já se protege
 * contra produção verificando NODE_ENV; o módulo só é importado quando
 * NODE_ENV !== 'production' (ver AppModule).
 */
@Module({
  imports: [ConversationModule],
  controllers: [DevController],
})
export class DevModule {}
