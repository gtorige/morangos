# Metabase + Turso — Setup Completo

Dashboards customizaveis com dados reais do Morangos.

## Arquitetura

```
┌─────────────┐       cron /15min        ┌─────────────┐         ┌──────────────┐
│   Turso     │ ────────────────────────▶│     Neon    │ ◀────── │   Metabase   │
│  (SQLite)   │   (Vercel sync cron)     │ (Postgres)  │  query  │   (Render)   │
│    = app    │                          │ = espelho   │         │ = dashboards │
└─────────────┘                          └─────────────┘         └──────────────┘
```

**Por que Neon no meio?** Metabase nao tem driver libSQL/Turso nativo. A solucao padrao e espelhar pra um Postgres que o Metabase suporta bem.

## Setup (total ~20 minutos)

### 1. Criar Neon Postgres (5 min)

1. Acesse https://console.neon.tech → **Sign up with GitHub**
2. **Create a project**:
   - Name: `morangos-metabase`
   - Region: `AWS us-east-1` (mesma do Turso → mais rapido)
   - Postgres version: 16 (ultima)
3. Va em **Connection Details** → copie a **Connection string**
   - Formato: `postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/morangos-metabase?sslmode=require`

### 2. Adicionar variaveis na Vercel (2 min)

```bash
# Adicione NEON_DATABASE_URL e CRON_SECRET no projeto Vercel
vercel env add NEON_DATABASE_URL production
# Cole a connection string do Neon

vercel env add CRON_SECRET production
# Gere um token aleatorio — ex: openssl rand -hex 32
```

Ou pela UI do Vercel: **Project Settings → Environment Variables**.

### 3. Testar a sync manualmente

Depois do proximo deploy, teste chamando:

```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" https://morangos-delta.vercel.app/api/cron/sync-metabase
```

Resposta esperada:
```json
{
  "ok": true,
  "tables": 18,
  "rows": 2500,
  "durationMs": 4500,
  "logs": ["Tabela: clientes", "  → 18 linha(s)", ...]
}
```

O cron `*/15 * * * *` rodara automaticamente a cada 15 minutos no plano Vercel Pro, ou 1x por dia no Hobby (Vercel Hobby so permite cron diario).

### 4. Deploy Metabase no Render (10 min)

1. Acesse https://render.com → **Sign up with GitHub**
2. **New +** → **Blueprint**
3. Conecte o repositorio `gtorige/morangos`
4. O Render detecta `.metabase-preview/render.yaml` — clique **Apply**
5. Aguarde ~5 min (build + start)
6. Copie a URL gerada (ex: `https://morangos-metabase.onrender.com`)

### 5. Primeiro setup do Metabase (3 min)

1. Abra a URL do Metabase
2. Crie conta admin (email + senha forte)
3. **Add your data**:
   - Database type: **PostgreSQL**
   - Display name: `Morangos`
   - Host: copie do Neon (sem o `postgresql://` e sem `/database`)
   - Port: `5432`
   - Database name: `morangos-metabase` (ou o que voce criou)
   - Username / Password: do Neon
   - SSL: **Enable** → **Always**
4. Clique **Connect database**
5. Pronto! Metabase vai explorar as tabelas e criar modelos automaticamente

### 6. Criar seu primeiro dashboard

1. **+ New** → **Question**
2. Escolha tabela (ex: `pedidos`)
3. Use a interface visual para:
   - Filtrar por `status_entrega = Entregue`
   - Agrupar por `data_entrega`
   - Somar `total`
4. Visualize como linha/barra/KPI
5. **Save** → adicione a um dashboard

## Embedding no Morangos (opcional)

Depois de criar dashboards legais, para embed-los na pagina `/resumo` do app:

### Opcao A: Link publico (simples)
1. No dashboard → **Sharing** (icone seta) → **Public link**
2. Copie a URL → iframe na pagina `/resumo`

### Opcao B: Signed embed (seguro)
1. Metabase Admin → **Embedding** → **Enable**
2. Copie a **Embedding secret key**
3. Na Vercel env vars: `METABASE_SECRET_KEY`
4. Backend gera JWT, frontend poe iframe com token

Pode ser feito quando quiser — avise se quiser que eu implemente.

## Limitacoes do free tier

### Render (Metabase)
- Dorme apos 15 min sem uso (primeiro acesso demora ~1min)
- 750h/mes gratis
- Solucao: Upgrade para $7/mes (Starter) ou usar Railway

### Neon (Postgres)
- 0.5 GB de storage → muito mais que suficiente para o Morangos
- Auto-suspend apos 5 min inativo → wake-up de 1-2s
- Branches ilimitados

### Vercel Cron
- **Hobby plan: max 1 cron por dia!**
- Pro plan: cron de minuto em minuto
- Alternativa: usar https://cron-job.org gratis para chamar o endpoint a cada 15 min

## Troubleshooting

### Sync falhando
Veja logs no Vercel: Project → **Observability** → **Functions** → `/api/cron/sync-metabase`

### Metabase dorme/lento
Normal no free tier. Upgrade Render Starter ($7/mes) resolve.

### Tabelas nao aparecem no Metabase
Admin → **Databases** → Morangos → **Sync database schema**

## Custos totais

| Servico | Plano | Custo |
|---------|-------|-------|
| Neon Postgres | Free | $0 |
| Render (Metabase) | Free | $0 |
| Vercel Cron | Hobby (1x/dia) | $0 |
| **Total** | | **$0/mes** |

Se precisar de sync mais frequente (<15min) ou Metabase que nao dorme:
- Render Starter: +$7/mes
- Vercel Pro (cron frequente): +$20/mes
