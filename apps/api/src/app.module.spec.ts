import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';

/**
 * Smoke test do grafo de DI: garante que todos os módulos resolvem
 * (sem dependências circulares não tratadas). Usa QUEUE_DRIVER=memory
 * e drivers simulados para não exigir Redis/Postgres no CI.
 */
describe('AppModule (DI graph)', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.QUEUE_DRIVER = 'memory';
    process.env.STORAGE_DRIVER = 'local';
    process.env.AI_DRIVER = 'mock';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ?? 'postgresql://x:x@localhost:5432/x';
    // Drivers reais ficam vazios -> providers simulados.
    process.env.FASHN_API_KEY = '';
    process.env.STRIPE_SECRET_KEY = '';
    process.env.GEMINI_API_KEY = '';
  });

  it('compila o módulo raiz', async () => {
    // Não chamamos init() (evita conectar no banco); só a compilação do
    // grafo já valida a resolução de dependências/circularidade.
    const compiled = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    expect(compiled).toBeDefined();
    await compiled.close();
  });
});
