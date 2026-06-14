/**
 * Carrega o .env ANTES de qualquer módulo ser avaliado.
 * Deve ser o PRIMEIRO import do main.ts — o decorator @Module do AppModule
 * (ConfigModule.forRoot -> validate) roda no momento do import, então o
 * process.env precisa já estar populado aqui.
 *
 * Procura o .env na raiz do monorepo e no diretório atual.
 */
import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

const candidates = [
  join(process.cwd(), '.env'),
  join(__dirname, '..', '..', '..', '.env'), // dist/.. -> raiz do monorepo
  join(__dirname, '..', '.env'),
];

for (const path of candidates) {
  if (existsSync(path)) {
    loadDotenv({ path });
    break;
  }
}
