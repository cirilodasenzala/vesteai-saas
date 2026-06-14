import * as bcrypt from 'bcryptjs';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminAuthService } from './admin-auth.service';
import { PrismaService } from '../../infra/prisma/prisma.service';

describe('AdminAuthService', () => {
  let service: AdminAuthService;
  const jwt = new JwtService({ secret: 'test-secret' });

  function buildPrisma(hash: string | null): PrismaService {
    return {
      adminUser: {
        findUnique: jest.fn(async () =>
          hash ? { id: 'a1', email: 'admin@x', passwordHash: hash, role: 'admin' } : null,
        ),
      },
    } as unknown as PrismaService;
  }

  it('emite JWT com credenciais válidas', async () => {
    const hash = await bcrypt.hash('segredo', 10);
    service = new AdminAuthService(buildPrisma(hash), jwt);
    const res = await service.login('admin@x', 'segredo');
    expect(res.accessToken).toBeDefined();
    const decoded = jwt.verify(res.accessToken) as { email: string };
    expect(decoded.email).toBe('admin@x');
  });

  it('rejeita senha errada', async () => {
    const hash = await bcrypt.hash('segredo', 10);
    service = new AdminAuthService(buildPrisma(hash), jwt);
    await expect(service.login('admin@x', 'errada')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejeita e-mail inexistente', async () => {
    service = new AdminAuthService(buildPrisma(null), jwt);
    await expect(service.login('no@x', 'x')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
