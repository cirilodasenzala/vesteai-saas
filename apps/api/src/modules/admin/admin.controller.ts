import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle as ThrottleDec } from '@nestjs/throttler';
import { AdminAuthService } from './admin-auth.service';
import { AdminService } from './admin.service';
import { HistoryService } from '../history/history.service';
import { JwtAdminGuard } from '../../common/guards/jwt-admin.guard';
import { LoginDto } from './dto/login.dto';

/**
 * API do painel administrativo.
 *  POST /admin/login            (público, rate-limited)
 *  GET  /admin/overview         (JWT) — cards do dashboard
 *  GET  /admin/users            (JWT) — lista paginada
 *  GET  /admin/conversations    (JWT) — suporte
 *  GET  /admin/logs             (JWT) — observabilidade
 *  GET  /admin/users/:id/history(JWT) — histórico do usuário
 */
@Controller('admin')
export class AdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly admin: AdminService,
    private readonly history: HistoryService,
  ) {}

  // Login mais restrito contra brute force.
  @ThrottleDec({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @UseGuards(JwtAdminGuard)
  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @UseGuards(JwtAdminGuard)
  @Get('users')
  users(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.admin.listUsers(Number(skip) || 0, Number(take) || 25);
  }

  @UseGuards(JwtAdminGuard)
  @Get('conversations')
  conversations(@Query('take') take?: string) {
    return this.admin.recentConversations(Number(take) || 25);
  }

  @UseGuards(JwtAdminGuard)
  @Get('logs')
  logs(@Query('scope') scope?: string, @Query('take') take?: string) {
    return this.admin.recentLogs(scope, Number(take) || 50);
  }

  @UseGuards(JwtAdminGuard)
  @Get('users/:id/history')
  userHistory(@Param('id') id: string) {
    return this.history.forUser(id);
  }
}
