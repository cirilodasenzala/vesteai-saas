import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/**
 * Seed mínimo: cria o AdminUser de bootstrap a partir das envs.
 * Idempotente (upsert por e-mail).
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL ?? 'admin@vesteai.local';
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? 'change-me';
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.adminUser.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, role: 'admin' },
  });

  // eslint-disable-next-line no-console
  console.log(`Admin de bootstrap garantido: ${email}`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
