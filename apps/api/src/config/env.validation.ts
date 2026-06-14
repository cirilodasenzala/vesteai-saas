import { z } from 'zod';

/**
 * Schema de validação das variáveis de ambiente.
 * Chaves de integração (FASHN/Stripe) são opcionais: quando ausentes,
 * o composition root seleciona os providers SIMULADOS.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  APP_BASE_URL: z.string().url().default('http://localhost:3000'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  // Banco / fila / storage drivers
  DB_DRIVER: z.enum(['postgres', 'sqlite']).default('postgres'),
  DATABASE_URL: z.string().min(1),
  QUEUE_DRIVER: z.enum(['redis', 'memory']).default('redis'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  WORKER_CONCURRENCY: z.coerce.number().default(2),

  // Segurança
  JWT_SECRET: z.string().min(8).default('change-me-please'),
  JWT_EXPIRES: z.string().default('1d'),
  PII_ENCRYPTION_KEY: z.string().optional(),

  // WhatsApp via Evolution API (vazio => modo simulado no dev)
  EVOLUTION_BASE_URL: z.string().optional(),
  EVOLUTION_API_KEY: z.string().optional(),
  EVOLUTION_INSTANCE: z.string().optional(),
  // Segredo opcional p/ validar o webhook (header apikey ou ?token=).
  EVOLUTION_WEBHOOK_TOKEN: z.string().optional(),

  // IA Stylist (Gemini)
  AI_DRIVER: z.enum(['gemini', 'mock']).default('gemini'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-1.5-pro'),

  // Provador (FASHN)
  FASHN_API_KEY: z.string().optional(),
  FASHN_BASE_URL: z.string().url().default('https://api.fashn.ai/v1'),

  // Pagamento (Stripe)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID_PREMIUM_MONTHLY: z.string().optional(),
  STRIPE_SUCCESS_URL: z.string().url().default('http://localhost:3000/billing/success'),
  STRIPE_CANCEL_URL: z.string().url().default('http://localhost:3000/billing/cancel'),

  // Storage (S3/MinIO)
  STORAGE_DRIVER: z.enum(['s3', 'local']).default('s3'),
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('vesteai'),
  S3_ACCESS_KEY: z.string().default('minioadmin'),
  S3_SECRET_KEY: z.string().default('minioadmin'),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  S3_PUBLIC_URL: z.string().default('http://localhost:9000'),

  // i18n / Admin
  DEFAULT_LANGUAGE: z.enum(['PT', 'EN']).default('PT'),
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().default('admin@vesteai.local'),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().default('change-me'),
});

export type Env = z.infer<typeof envSchema>;

/** Valida process.env e lança erro legível em caso de configuração inválida. */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuração de ambiente inválida:\n${issues}`);
  }
  return parsed.data;
}
