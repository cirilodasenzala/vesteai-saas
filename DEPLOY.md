# 🚀 Guia de Deploy — VesteAI (Hostinger VPS + EasyPanel)

Guia passo a passo para colocar o VesteAI no ar usando **GitHub → EasyPanel**,
com **Evolution API** (WhatsApp), **Postgres + Redis** internos e **S3/R2** para imagens.

> Tempo estimado: 30–45 min. Faça na ordem. Cada passo tem uma verificação ✅.

---

## Visão geral do que vamos montar

```
WhatsApp do cliente
      │
      ▼
 Evolution API (já roda no seu EasyPanel)
      │  webhook (messages.upsert + base64)
      ▼
 VesteAI API  ──►  Postgres (EasyPanel)
   (este app)  ──►  Redis (EasyPanel)
                ──►  Gemini / FASHN / Stripe (internet)
                ──►  S3 / Cloudflare R2 (imagens do provador)
```

---

## Pré-requisitos (você já tem)

- [x] VPS Hostinger com **EasyPanel** instalado
- [x] **Evolution API** rodando no EasyPanel (com uma instância criada)
- [x] Conta GitHub
- [x] Chaves: Gemini, FASHN, Stripe (no seu `.env` local)
- [ ] Bucket S3 (AWS) **ou** Cloudflare R2 (criaremos no Passo 6)
- [ ] Um domínio/subdomínio para a API (ex.: `api.seudominio.com`)

---

## Passo 1 — Enviar o código para o GitHub

O repositório já está iniciado e commitado localmente (branch `main`, sem segredos).

1. No GitHub, crie um **repositório vazio** (ex.: `vesteai`) — **sem** README/license.
2. No seu PC, na pasta do projeto (`C:\Users\David\Documents\David emprase`), rode no
   PowerShell/Git Bash:

```bash
git remote add origin https://github.com/SEU_USUARIO/vesteai.git
git push -u origin main
```

> Se pedir login, use seu usuário + um **Personal Access Token** (Settings → Developer
> settings → Tokens) como senha.

✅ **Verificação:** atualize a página do repo no GitHub — você deve ver as pastas
`apps/`, `packages/`, `scripts/` e os arquivos de config. **Não** deve haver `.env`.

---

## Passo 2 — Criar o Postgres no EasyPanel

1. No EasyPanel, abra seu **Project** (ou crie um chamado `vesteai`).
2. **+ Service → Postgres**.
3. Defina:
   - **Service name**: `vesteai-db`
   - **Database**: `vesteai`
   - **User**: `vesteai`
   - **Password**: gere uma forte e **anote**.
4. Create. Aguarde ficar verde (running).

✅ A `DATABASE_URL` interna será:
```
postgresql://vesteai:SUA_SENHA@vesteai-db:5432/vesteai?schema=public
```
> O host é o **nome do serviço** (`vesteai-db`) — funciona pela rede interna do EasyPanel.

---

## Passo 3 — Criar o Redis no EasyPanel

1. **+ Service → Redis**.
2. **Service name**: `vesteai-redis`. Create.

✅ Use depois: `REDIS_HOST=vesteai-redis`, `REDIS_PORT=6379`.

---

## Passo 4 — Gerar os segredos da aplicação

No seu PC (PowerShell), gere a chave de criptografia de PII e um JWT secret:

```powershell
# PII_ENCRYPTION_KEY (32 bytes base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# JWT_SECRET (qualquer string forte com 8+ chars)
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Anote os dois valores. (Você já tem um `PII_ENCRYPTION_KEY` no `.env` local — pode reusar
o mesmo, mas **gere um novo para produção** por segurança.)

---

## Passo 5 — Configurar o Stripe (assinatura)

1. No dashboard do Stripe → **Products** → **+ Add product**:
   - Nome: `VesteAI Premium`
   - Preço: **recorrente / mensal** (ex.: R$ 49,90/mês)
2. Após salvar, copie o **Price ID** (começa com `price_...`) → será `STRIPE_PRICE_ID_PREMIUM_MONTHLY`.
3. **Webhook** (Developers → Webhooks → Add endpoint):
   - URL: `https://api.seudominio.com/webhooks/stripe`
   - Eventos: `checkout.session.completed`, `invoice.paid`,
     `customer.subscription.deleted`, `invoice.payment_failed`
   - Copie o **Signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`.

> ⚠️ Sem o `STRIPE_PRICE_ID_PREMIUM_MONTHLY` o checkout falha (o app avisa o cliente
> educadamente, mas ninguém consegue pagar). Não pule este passo.

---

## Passo 6 — Criar o bucket de imagens (Cloudflare R2 recomendado)

As imagens do provador precisam de **URL pública** para o WhatsApp baixar.

**Opção A — Cloudflare R2 (recomendado, barato):**
1. Cloudflare → R2 → **Create bucket** (ex.: `vesteai`).
2. Em **Settings** do bucket → **Public access** → habilite (R2.dev) ou conecte um domínio.
3. **Manage R2 API Tokens** → crie um token (Read & Write). Anote:
   - Access Key ID, Secret Access Key
   - Endpoint: `https://<accountid>.r2.cloudflarestorage.com`
   - URL pública do bucket (ex.: `https://pub-xxxx.r2.dev`)

Valores para o app:
```
STORAGE_DRIVER=s3
S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=vesteai
S3_ACCESS_KEY=<r2 access key>
S3_SECRET_KEY=<r2 secret>
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_URL=https://pub-xxxx.r2.dev
```

**Opção B — AWS S3:** crie o bucket, libere acesso público de leitura (ou use URLs
assinadas que o app já gera), e preencha `S3_ENDPOINT` (vazio/região), `S3_REGION`,
`S3_BUCKET`, chaves, `S3_PUBLIC_URL=https://<bucket>.s3.<regiao>.amazonaws.com`.

---

## Passo 7 — Criar o App do VesteAI no EasyPanel

1. **+ Service → App**.
2. **Service name**: `vesteai-api`.
3. **Source → GitHub**: conecte sua conta, escolha o repo `vesteai` e a branch `main`.
4. **Build → Dockerfile**:
   - **Dockerfile Path**: `apps/api/Dockerfile`
   - **Build Context**: `.` (raiz do repo)
5. Ainda **não** clique em deploy — primeiro configure as env vars (Passo 8).

---

## Passo 8 — Variáveis de ambiente do App

Em `vesteai-api` → **Environment**, cole (ajustando os valores):

```env
NODE_ENV=production
PORT=3000
APP_BASE_URL=https://api.seudominio.com
LOG_LEVEL=info

# Banco (serviço do Passo 2)
DATABASE_URL=postgresql://vesteai:SUA_SENHA@vesteai-db:5432/vesteai?schema=public

# Fila (serviço do Passo 3)
QUEUE_DRIVER=redis
REDIS_HOST=vesteai-redis
REDIS_PORT=6379
WORKER_CONCURRENCY=2

# Segurança (Passo 4)
JWT_SECRET=<seu jwt secret>
PII_ENCRYPTION_KEY=<sua chave base64 de 32 bytes>

# WhatsApp via Evolution (Passo 9)
EVOLUTION_BASE_URL=http://<nome-do-servico-evolution>:8080
EVOLUTION_API_KEY=<apikey da Evolution>
EVOLUTION_INSTANCE=<nome da sua instancia>
EVOLUTION_WEBHOOK_TOKEN=<um segredo qualquer que voce escolher>

# IA Stylist
AI_DRIVER=gemini
GEMINI_API_KEY=<sua chave Gemini>
GEMINI_MODEL=gemini-1.5-pro

# Provador
FASHN_API_KEY=<sua chave FASHN>
FASHN_BASE_URL=https://api.fashn.ai/v1

# Pagamento (Passo 5)
STRIPE_SECRET_KEY=<sua chave secreta Stripe>
STRIPE_WEBHOOK_SECRET=<whsec_...>
STRIPE_PRICE_ID_PREMIUM_MONTHLY=<price_...>
STRIPE_SUCCESS_URL=https://api.seudominio.com/billing/success
STRIPE_CANCEL_URL=https://api.seudominio.com/billing/cancel

# Storage (Passo 6)
STORAGE_DRIVER=s3
S3_ENDPOINT=<endpoint R2/S3>
S3_REGION=auto
S3_BUCKET=vesteai
S3_ACCESS_KEY=<access key>
S3_SECRET_KEY=<secret>
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_URL=<url publica do bucket>

# Admin (painel)
ADMIN_BOOTSTRAP_EMAIL=seu-email@dominio.com
ADMIN_BOOTSTRAP_PASSWORD=<senha forte do admin>
DEFAULT_LANGUAGE=PT
```

> Para descobrir o **nome do serviço da Evolution** e a porta: abra o serviço dela no
> EasyPanel — o nome interno é o que vai em `EVOLUTION_BASE_URL`. A porta padrão da
> Evolution é `8080` (confirme nas configs dela).

---

## Passo 9 — Domínio + Deploy

1. Em `vesteai-api` → **Domains** → adicione `api.seudominio.com`
   (aponte o DNS do domínio para o IP da VPS; o EasyPanel emite HTTPS via Let's Encrypt).
2. **Proxy port**: `3000`.
3. Clique em **Deploy**. Acompanhe os logs do build.

✅ **Verificação:** acesse `https://api.seudominio.com/health` →
deve retornar `{"status":"ok","info":{"database":{"status":"up"}}}`.

> O container roda `prisma migrate deploy` automaticamente no boot — as tabelas são
> criadas na primeira subida. O usuário admin é criado a partir de `ADMIN_BOOTSTRAP_*`
> **apenas se você rodar o seed** (veja "Seed do admin" abaixo).

---

## Passo 10 — Conectar a Evolution API ao VesteAI

Configure o webhook da sua instância Evolution para chamar o VesteAI. Via API da
Evolution (substitua URL/apikey/instância):

```bash
curl -X POST "http://SEU_EVOLUTION/webhook/set/SUA_INSTANCIA" \
  -H "apikey: SUA_APIKEY_EVOLUTION" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "enabled": true,
      "url": "https://api.seudominio.com/webhooks/evolution?token=SEU_EVOLUTION_WEBHOOK_TOKEN",
      "webhookByEvents": false,
      "webhookBase64": true,
      "events": ["MESSAGES_UPSERT"]
    }
  }'
```

> O `?token=...` deve ser igual ao `EVOLUTION_WEBHOOK_TOKEN` que você pôs no Passo 8.
> Se preferir, alguns painéis da Evolution têm essa config na UI (Webhook → URL +
> eventos + base64).

✅ **Verificação:** confirme que a instância está **conectada** (QR escaneado) no painel
da Evolution.

---

## Passo 11 — Seed do admin (primeiro acesso ao painel)

O painel admin precisa de um usuário. Rode o seed **uma vez** dentro do container:

1. EasyPanel → `vesteai-api` → **Console/Terminal** (ou via SSH `docker exec`).
2. Rode:
```bash
node -e "require('dotenv')" 2>/dev/null; npx prisma db seed --schema=apps/api/prisma/schema.prisma
```
> Se o comando acima não funcionar pela config, use:
> `ADMIN_BOOTSTRAP_EMAIL=... ADMIN_BOOTSTRAP_PASSWORD=... npx ts-node apps/api/prisma/seed.ts`
> (as envs já estão no ambiente do container, então só `npx ... seed.ts` costuma bastar).

✅ Acesse `https://api.seudominio.com/admin-ui/` e faça login com
`ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD`.

---

## Passo 12 — Teste de ponta a ponta (produção)

1. Envie **"oi"** do seu WhatsApp para o número conectado na Evolution.
   → Você recebe as **boas-vindas + link de pagamento**.
2. Pague pelo link (Stripe). → O webhook confirma e inicia o **onboarding**.
3. Responda o onboarding (nome, idade, etc.). → Vira `IDLE`.
4. Peça **"tenho um casamento sábado"** → recebe perguntas e o look recomendado.
5. **"quero experimentar uma roupa"** → envie foto do corpo + foto da roupa
   → recebe a imagem do provador (via FASHN).
6. Abra o **painel admin** e veja as métricas subindo.

---

## Manutenção & dicas

- **Atualizar o app**: faça `git push` → no EasyPanel clique em **Deploy** (ou ative
  auto-deploy por webhook do GitHub). As migrações rodam sozinhas no boot.
- **Logs**: EasyPanel → `vesteai-api` → Logs. Procure linhas com `ERROR`.
- **Trocar de idioma**: automático — o stylist responde no idioma do cliente.
- **Modo simulado**: se deixar `EVOLUTION_*`/`FASHN_API_KEY`/`STRIPE_SECRET_KEY` vazios,
  o app roda em modo simulado (útil para testar sem cobrar/enviar de verdade).
- **Backups**: configure backup do serviço Postgres no EasyPanel.

---

## Solução de problemas

| Sintoma | Causa provável | Ação |
|--------|----------------|------|
| `/health` com `database: down` | `DATABASE_URL` errada / Postgres não subiu | Confira nome do serviço e senha |
| Cliente recebe boas-vindas mas não o link | `STRIPE_PRICE_ID_PREMIUM_MONTHLY` vazio/inválido | Passo 5 |
| Imagem do provador não chega | `S3_PUBLIC_URL` sem acesso público | Passo 6 (tornar bucket público) |
| Webhook Evolution não chega | URL/token errados ou instância desconectada | Passo 10 |
| Build falha no EasyPanel | Dockerfile Path/Context errados | Passo 7 (`apps/api/Dockerfile`, contexto `.`) |
| `403` no webhook | `EVOLUTION_WEBHOOK_TOKEN` ≠ `?token=` | Igualar os dois |
