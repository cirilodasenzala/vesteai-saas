import { Language } from '@vesteai/shared';
import { ReferralService } from './referral.service';
import { PrismaService } from '../../infra/prisma/prisma.service';

describe('ReferralService', () => {
  let service: ReferralService;
  let store: Array<{ id: string; referrerId: string; referredId: string | null; code: string; rewarded: boolean }>;

  beforeEach(() => {
    store = [];
    const prisma = {
      referral: {
        findFirst: jest.fn(async ({ where }: { where: { referrerId: string; referredId: null } }) =>
          store.find((r) => r.referrerId === where.referrerId && r.referredId === null) ?? null,
        ),
        findUnique: jest.fn(async ({ where }: { where: { code: string } }) =>
          store.find((r) => r.code === where.code) ?? null,
        ),
        create: jest.fn(async ({ data }: { data: { referrerId: string; code: string } }) => {
          const row = { id: `r${store.length}`, referredId: null, rewarded: false, ...data };
          store.push(row);
          return row;
        }),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = store.find((r) => r.id === where.id)!;
          Object.assign(row, data);
          return row;
        }),
      },
    } as unknown as PrismaService;
    service = new ReferralService(prisma);
  });

  it('gera código idempotente para o mesmo usuário', async () => {
    const c1 = await service.getOrCreateCode('u1', Language.PT);
    const c2 = await service.getOrCreateCode('u1', Language.PT);
    expect(c1).toBe(c2);
    expect(c1).toMatch(/^VESTE[0-9A-F]{6}$/);
  });

  it('resgata um código válido para outro usuário', async () => {
    const code = await service.getOrCreateCode('u1', Language.PT);
    const ok = await service.redeem(code, 'u2');
    expect(ok).toBe(true);
    // segundo resgate falha (já usado)
    expect(await service.redeem(code, 'u3')).toBe(false);
  });

  it('não permite auto-indicação', async () => {
    const code = await service.getOrCreateCode('u1', Language.PT);
    expect(await service.redeem(code, 'u1')).toBe(false);
  });
});
