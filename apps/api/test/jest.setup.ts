/**
 * Setup global do Jest — define envs mínimas ANTES de qualquer import de
 * módulo que valide configuração (config.module). Evita falha de validação
 * em testes que compilam o AppModule.
 */
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://x:x@localhost:5432/x?schema=public';
process.env.QUEUE_DRIVER = process.env.QUEUE_DRIVER ?? 'memory';
process.env.STORAGE_DRIVER = process.env.STORAGE_DRIVER ?? 'local';
process.env.AI_DRIVER = process.env.AI_DRIVER ?? 'mock';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-please';
