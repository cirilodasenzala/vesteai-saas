import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * AdminAuthService — login do painel: valida o AdminUser (bcrypt) e emite
 * um JWT. Sem signup público (admins criados via seed/bootstrap).
 */
@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; email: string }> {
    const admin = await this.prisma.adminUser.findUnique({ where: { email } });
    if (!admin) throw new UnauthorizedException('Credenciais inválidas.');

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciais inválidas.');

    const accessToken = await this.jwt.signAsync({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    });
    return { accessToken, email: admin.email };
  }
}
