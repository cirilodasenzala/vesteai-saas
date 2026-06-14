# VesteAI API

Backend NestJS do VesteAI — Personal Stylist Premium com IA no WhatsApp.

## Pré-requisitos

- Node.js 20+ (instalado: v26)
- Docker Desktop **com WSL2** (para Postgres/Redis/MinIO)
- npm (workspaces)

> ⚠️ Se acabou de instalar o WSL2, **reinicie o Windows** antes de subir o Docker.

## Setup rápido (dev)

Da raiz do monorepo:

```powershell
# 1. Instalar dependências (uma vez)
npm install
npm run build --workspace @vesteai/shared

# 2. Copiar envs e ajustar se quiser
Copy-Item .env.example .env   # já existe um .env de dev pronto

# 3. Subir infra + migração + seed (após reiniciar, se instalou WSL2)
./scripts/dev-up.ps1

# 4. Rodar a API
npm run api:dev
```

Verificação da Fase 1 (com a API no ar, em outro terminal):

```powershell
./scripts/verify-phase1.ps1
```

## Modo SIMULADO (sem chaves externas)

O `.env` de dev vem com:

- `AI_DRIVER=mock` — stylist responde de forma determinística (sem Gemini).
- `FASHN_API_KEY=` vazio — provador usa imagem placeholder.
- `STRIPE_SECRET_KEY=` vazio — pagamento via `/dev/pay/:token` (Fase 2).
- `WHATSAPP_ACCESS_TOKEN=` vazio — envios são apenas logados (`[SIMULADO]`).
- `STORAGE_DRIVER=local` — grava em `./.storage` (sem MinIO).
- `QUEUE_DRIVER=memory` — fila em memória (sem Redis).

Preencha as chaves reais no `.env` para ativar cada integração — o código
seleciona automaticamente o provider real vs simulado.

## Banco de dados

Schema canônico: `prisma/schema.prisma` (PostgreSQL, com enums e arrays).

```powershell
npm run prisma:migrate --workspace @vesteai/api   # cria/aplica migração
npm run prisma:studio  --workspace @vesteai/api   # GUI do banco
```

## Endpoints da Fase 1

| Método | Rota | Descrição |
|-------|------|-----------|
| GET | `/health` | Liveness/readiness (checa banco) |
| GET | `/webhooks/whatsapp` | Handshake de verificação da Meta |
| POST | `/webhooks/whatsapp` | Recebe mensagens (assinatura HMAC verificada) |
| POST | `/dev/wa/inbound` | **Só dev** — injeta mensagem inbound sem a Meta |

## Testes

```powershell
npm run test --workspace @vesteai/api
```

## Estrutura

Ver o plano em `.claude/plans/` e o diagrama de pastas no topo do projeto.
Camadas: `core/ports` (interfaces) → `infra/*` (adaptadores) → `modules/*`
(features) — seguindo Clean Architecture + SOLID.
