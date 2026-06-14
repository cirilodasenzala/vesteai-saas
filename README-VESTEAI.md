# VesteAI — Personal Stylist Premium no WhatsApp 👔✨

SaaS de produção: um consultor de imagem com IA que vive dentro do WhatsApp.
O usuário envia foto do corpo + foto de uma roupa e recebe um provador virtual
realista, além de looks por ocasião, consultoria de imagem e memória permanente.

> O MVP web original (quiz de estilo) continua intocado em `index.html`, `js/`,
> `data/` e `styles/`. Este documento descreve o **backend SaaS** em `apps/api`.

---

## Arquitetura

Monorepo **npm workspaces** · **NestJS + TypeScript** · **Prisma/PostgreSQL** ·
**BullMQ/Redis** · **S3/MinIO** · Clean Architecture + SOLID.

```
apps/api/src/
├── core/ports/        # interfaces (DIP): Payment, AIStylist, Storage, TryOn
├── infra/             # adaptadores (real vs simulado) + providers.module.ts
│   ├── ai/            # Gemini + Mock
│   ├── payment/       # Stripe + Simulado
│   ├── tryon/         # FASHN + Simulado
│   └── storage/       # S3/MinIO + Local
├── modules/           # features: whatsapp, conversation, auth, subscription,
│                      #   onboarding, memory, stylist, events, tryon, wardrobe,
│                      #   referral, history, admin, billing, dev
└── queue/             # BullMQ (redis) ou inline (memory) + tryon.processor
```

O **composition root** (`infra/providers.module.ts`) decide, por env, qual
implementação atende cada porta. Sem chaves → modo **simulado** (roda 100% local).

---

## Fases implementadas

| Fase | Entrega | Estado |
|------|---------|--------|
| 1 | Webhook WhatsApp (verify + assinatura HMAC), boas-vindas, sender, /health | ✅ |
| 2 | Auth por número, assinatura (Stripe+sim), onboarding, memória, idioma automático | ✅ |
| 3 | Stylist Gemini (persona premium), eventos (slot-filling) → look, consultoria | ✅ |
| 4 | Provador (FASHN+sim), fila BullMQ, storage, guarda-roupa | ✅ |
| 5 | Painel admin (JWT) + métricas + histórico (`/admin-ui/`) | ✅ |
| 6 | Nota de look (8,7/10), paleta de cores, programa de indicação | ✅ |

**34 testes unitários verdes** (12 suítes), incluindo smoke test do grafo de DI.

---

## Como rodar (dev)

Pré-requisitos: Node 20+, Docker Desktop **com WSL2** (reinicie o Windows após
instalar o WSL2).

```powershell
npm install
npm run build --workspace @vesteai/shared

# Sobe Postgres/Redis/MinIO + migração + seed:
./scripts/dev-up.ps1

# API:
npm run api:dev
```

Verificação ponta a ponta (com a API no ar):

```powershell
./scripts/verify-phase1.ps1   # webhook + boas-vindas
./scripts/verify-phase2.ps1   # pagamento simulado → onboarding
./scripts/verify-phase3.ps1   # eventos + consultoria
./scripts/verify-phase4.ps1   # provador + guarda-roupa
./scripts/verify-phase5.ps1   # painel admin (login + métricas)
```

Painel admin visual: <http://localhost:3000/admin-ui/>

---

## Modo simulado (sem chaves externas)

O `.env` de dev já vem assim — permite testar tudo sem contas externas:

| Variável vazia | Efeito |
|----------------|--------|
| `STRIPE_SECRET_KEY` | pagamento via `GET /dev/pay/:token` |
| `FASHN_API_KEY` | provador devolve placeholder |
| `WHATSAPP_ACCESS_TOKEN` | envios apenas logados (`[SIMULADO]`) |
| `GEMINI_API_KEY` / `AI_DRIVER=mock` | stylist determinístico |
| `STORAGE_DRIVER=local` | grava em `./.storage` |
| `QUEUE_DRIVER=memory` | fila inline (sem Redis) |

Preencha cada chave para ativar a integração real — o código troca o provider
automaticamente.

---

## Segurança & LGPD

Assinatura de webhooks (HMAC/Stripe) sobre corpo bruto · PII (nome) cifrada
AES-256-GCM · JWT no admin com rate-limit · validação de imagem por magic bytes ·
rate limiting global · idempotência (mensagens e pagamentos) · logs estruturados.

---

## Testar e buildar

```powershell
npm run api:test     # jest
npm run api:build    # tsc -> dist/
```
