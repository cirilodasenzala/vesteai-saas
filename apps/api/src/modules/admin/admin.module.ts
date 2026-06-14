import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminService } from './admin.service';
import { JwtAdminGuard } from '../../common/guards/jwt-admin.guard';
import type { AppConfig } from '../../config/config.module';

/**
 * AdminModule — painel administrativo (API). HistoryService vem do
 * HistoryModule (@Global). JwtModule configurado a partir do APP_CONFIG.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: ['APP_CONFIG'],
      useFactory: (config: AppConfig) => ({
        secret: config.JWT_SECRET,
        signOptions: { expiresIn: config.JWT_EXPIRES },
      }),
    }),
  ],
  controllers: [AdminController],
  providers: [AdminAuthService, AdminService, JwtAdminGuard],
})
export class AdminModule {}
