import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

/**
 * Guard que exige um JWT de admin válido no header Authorization: Bearer.
 * Anexa o payload em req.admin.
 */
@Injectable()
export class JwtAdminGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { admin?: unknown }>();
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token ausente.');
    }
    const token = auth.slice('Bearer '.length);
    try {
      req.admin = await this.jwt.verifyAsync(token);
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }
  }
}
