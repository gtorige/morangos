# Documentacao Tecnica — Morangos v2.0.2

## Visao Geral

Sistema de gestao para fazenda de morangos. Controla pedidos, entregas, clientes, produtos, promocoes, contas a pagar, pedidos recorrentes e otimizacao de rotas. Interface em portugues brasileiro (pt-BR).

**Stack:** Next.js 16 + React 19 + TypeScript 5 + Prisma 5 + SQLite + Tailwind CSS 4

---

## Arquitetura

```
Browser (PC/Celular)
    |
    v
Next.js 16 (App Router)
    |
    +-- Middleware (auth.ts) -----> JWT session check
    |
    +-- Pages ("use client") ----> React 19 components
    |
    +-- API Routes (REST) -------> Zod validation --> Prisma ORM --> SQLite
```

Todas as paginas sao client components (`"use client"`). Dados carregados via `fetch()` para as API routes. Nenhum server component ou SSR.

---

## Banco de Dados

**Engine:** SQLite (arquivo `prisma/dev.db`)
**ORM:** Prisma 5.22

### Modelos (15 tabelas)

| Modelo | Tabela | Descricao |
|--------|--------|-----------|
| Cliente | `clientes` | Cadastro de clientes |
| Produto | `produtos` | Catalogo de produtos |
| Promocao | `promocoes` | Regras de desconto |
| FormaPagamento | `formas_pagamento` | Dinheiro, Pix, etc. |
| Pedido | `pedidos` | Pedidos de venda |
| PedidoItem | `pedido_itens` | Itens de cada pedido |
| PedidoRecorrente | `pedidos_recorrentes` | Templates recorrentes |
| PedidoRecorrenteItem | `pedido_recorrente_itens` | Itens do template |
| Fornecedor | `fornecedores` | Fornecedores |
| Categoria | `categorias` | Categorias de contas |
| Subcategoria | `subcategorias` | Subcategorias |
| Conta | `contas` | Contas a pagar |
| Usuario | `usuarios` | Usuarios do sistema |
| Configuracao | `configuracoes` | Chave-valor |
| LocalFrequente | `locais_frequentes` | Enderecos frequentes |
| MensagemWhatsApp | `mensagens_whatsapp` | Templates WhatsApp |

### Relacionamentos

```
Cliente 1--N Pedido
Cliente 1--N PedidoRecorrente
Produto 1--N PedidoItem
Produto 1--N PedidoRecorrenteItem
Produto 1--N Promocao
FormaPagamento 1--N Pedido
Pedido 1--N PedidoItem (cascade delete)
PedidoRecorrente 1--N PedidoRecorrenteItem (cascade delete)
PedidoRecorrente 1--N Pedido (generated orders)
Fornecedor 1--N Conta
Categoria 1--N Conta
Categoria 1--N Subcategoria (cascade delete)
Subcategoria 1--N Conta
```

### Indices (14)

| Tabela | Colunas |
|--------|---------|
| promocoes | `produto_id` |
| promocoes | `ativo, data_inicio, data_fim` |
| pedidos | `cliente_id` |
| pedidos | `data_entrega` |
| pedidos | `cliente_id, data_entrega` |
| pedido_itens | `pedido_id` |
| pedido_itens | `produto_id` |
| subcategorias | `nome, categoria_id` (unique) |
| contas | `fornecedor_id` |
| contas | `categoria_id` |
| contas | `subcategoria_id` |
| pedidos_recorrentes | `cliente_id` |
| pedidos_recorrentes | `ativo` |
| pedido_recorrente_itens | `pedido_recorrente_id` |

### Valores de Status

| Campo | Valores |
|-------|---------|
| `situacao_pagamento` | `Pendente`, `Pago` |
| `status_entrega` | `Pendente`, `Em rota`, `Entregue`, `Cancelado` |
| `conta.situacao` | `Pendente`, `Pago` |
| `promocao.tipo` | `desconto`, `leve_x_pague_y`, `quantidade_minima`, `compra_parceira` |

### Formatos de Data

- Datas armazenadas como strings ISO: `YYYY-MM-DD`
- Timestamps: `YYYY-MM-DDTHH:mm:ss`
- Exibicao: `DD/MM/YYYY` (formatDate)

---

## API Routes

### Autenticacao

| Rota | Metodo | Descricao | Auth |
|------|--------|-----------|------|
| `/api/login` | POST | Login (username, password) | Nao |
| `/api/setup` | GET | Verifica se admin existe | Nao |
| `/api/setup` | POST | Cria admin inicial | Nao |
| `/api/auth/change-password` | POST | Alterar senha | Sim |
| `/api/auth/[...nextauth]` | * | NextAuth handlers | Nao |
| `/api/admin/usuarios` | GET, POST | Listar/criar usuarios | Admin |
| `/api/admin/usuarios/[id]` | PUT, DELETE | Editar/excluir usuario | Admin |

### Pedidos

| Rota | Metodo | Descricao |
|------|--------|-----------|
| `/api/pedidos` | GET | Listar (filtros: cliente, bairro, data, status, etc.) |
| `/api/pedidos` | POST | Criar pedido (com calculo automatico de promocoes) |
| `/api/pedidos/[id]` | GET | Detalhe do pedido |
| `/api/pedidos/[id]` | PUT | Atualizar pedido (com transacao) |
| `/api/pedidos/[id]` | DELETE | Excluir pedido (com transacao) |
| `/api/pedidos/bulk` | PATCH | Acoes em massa (entregue, pago, cancelar, excluir) |

### Pedidos Recorrentes

| Rota | Metodo | Descricao |
|------|--------|-----------|
| `/api/recorrentes` | GET | Listar recorrentes |
| `/api/recorrentes` | POST | Criar (gera pedidos automaticamente) |
| `/api/recorrentes/[id]` | PUT | Atualizar (regenera pedidos pendentes) |
| `/api/recorrentes/[id]` | DELETE | Excluir (aceita `keepOrderIds` para exclusao seletiva) |
| `/api/recorrentes/gerar` | POST | Gerar pedidos para data especifica |

### Clientes, Produtos, Promocoes

| Rota | Metodos | Descricao |
|------|---------|-----------|
| `/api/clientes` | GET, POST | CRUD clientes (busca por nome/telefone/bairro) |
| `/api/clientes/[id]` | GET, PUT, DELETE | Detalhe/editar/excluir |
| `/api/produtos` | GET, POST | CRUD produtos |
| `/api/produtos/[id]` | GET, PUT, DELETE | Detalhe/editar/excluir (protege historico) |
| `/api/promocoes` | GET, POST | CRUD promocoes |
| `/api/promocoes/[id]` | GET, PUT, DELETE | Detalhe/editar/excluir |

### Financeiro

| Rota | Metodos | Descricao |
|------|---------|-----------|
| `/api/contas` | GET, POST | CRUD contas a pagar |
| `/api/contas/[id]` | GET, PUT, DELETE | Detalhe/editar/excluir |
| `/api/fornecedores` | GET, POST | CRUD fornecedores |
| `/api/fornecedores/[id]` | PUT, DELETE | Editar/excluir |
| `/api/categorias` | GET, POST | CRUD categorias |
| `/api/categorias/[id]` | PUT, DELETE | Editar/excluir |
| `/api/subcategorias` | GET, POST | CRUD subcategorias |
| `/api/subcategorias/[id]` | DELETE | Excluir |

### Rota e Entrega

| Rota | Metodo | Descricao |
|------|--------|-----------|
| `/api/rota` | GET | Pedidos pendentes do dia por localizacao |
| `/api/rota/otimizar` | POST | Otimizar rota (Google Routes API) |
| `/api/rota/mapa` | GET | URL do Google Maps embed |
| `/api/separacao` | GET | Lista de produtos para carregar |
| `/api/notificacoes` | GET | Alertas (pagamentos vencidos, contas) |

### Outros

| Rota | Metodo | Descricao |
|------|--------|-----------|
| `/api/resumo` | GET | Dashboard KPIs (vendas, comparativos) |
| `/api/busca` | GET | Busca global (clientes + produtos) |
| `/api/exportar` | GET | Exportar CSV |
| `/api/backup` | GET | Download do banco SQLite (admin) |
| `/api/formas-pagamento` | GET | Listar formas de pagamento |
| `/api/configuracoes` | GET, POST | Ler/salvar configuracoes |
| `/api/locais-frequentes` | GET, POST | CRUD locais frequentes |
| `/api/mensagens-whatsapp` | GET, POST | CRUD templates WhatsApp |

---

## Validacao (Zod)

Todas as rotas POST/PUT usam validacao Zod via `parseBody()`.

Schemas definidos em `src/lib/schemas.ts`:
- `clienteCreateSchema` / `clienteUpdateSchema`
- `produtoCreateSchema` / `produtoUpdateSchema`
- `promocaoCreateSchema` / `promocaoUpdateSchema`
- `pedidoCreateSchema` / `pedidoUpdateSchema`
- `pedidoBulkSchema`
- `contaCreateSchema` / `contaUpdateSchema`
- `recorrenteCreateSchema` / `recorrenteUpdateSchema`
- `fornecedorSchema`, `categoriaSchema`, `subcategoriaCreateSchema`
- `localFrequenteSchema`, `mensagemWhatsAppSchema`, `configuracaoSchema`

Limites de string: 20-2000 caracteres conforme o campo.
Numeros: positivos, com limites min/max.
Datas: formato `YYYY-MM-DD` validado por regex.

---

## Tratamento de Erros

Centralizado em `src/lib/api-helpers.ts`:

| Tipo | Status HTTP | Mensagem |
|------|------------|----------|
| ZodError | 400 | "Dados invalidos" + detalhes |
| ApiError | custom | Mensagem personalizada |
| Prisma P2002 | 409 | "Registro duplicado" |
| Prisma P2025 | 404 | "Registro nao encontrado" |
| Prisma P2003 | 400 | "Referencia invalida" |
| Erro generico | 500 | "Erro interno do servidor" |

---

## Autenticacao e Seguranca

**Tecnologia:** NextAuth v5 (beta) com Credentials provider
**Sessao:** JWT (sem banco de sessoes)
**Senha:** bcryptjs hash (salt rounds: 10)

### Fluxo de Login

```
POST /api/login { username, password }
  -> Busca usuario no banco
  -> bcrypt.compare(password, hash)
  -> Encode JWT com { id, username, isAdmin }
  -> Set cookie "authjs.session-token" (httpOnly, sameSite: lax)
  -> Return { ok: true }
```

### Middleware

Arquivo: `middleware.ts`
Exporta `auth` do NextAuth como middleware.

Rotas publicas (definidas no callback `authorized`):
- `/login`, `/setup`
- `/api/login`, `/api/setup`, `/api/auth`

Todas as outras rotas redirecionam para `/login` se nao autenticado.

### Configuracao

- `trustHost: true` — aceita qualquer hostname (localhost, IP)
- `useSecureCookies: false` — funciona em HTTP (rede local)
- Sem `NEXTAUTH_URL` necessario

---

## Logica de Promocoes

### Tipos

| Tipo | Descricao | Exemplo |
|------|-----------|---------|
| `desconto` | Preco fixo promocional | R$ 10 em vez de R$ 15 |
| `leve_x_pague_y` | Leve X, pague Y unidades | Leve 3 pague 2 |
| `quantidade_minima` | Preco especial acima de X un. | 4+ un. → R$ 25 |
| `compra_parceira` | Produto A no pedido → B com desconto | Morango 500g → Geleia R$ 28 |

### Prioridade de Aplicacao

```
1. Preco manual (usuario editou) → nunca sobrescrito
2. quantidade_minima (melhor tier) → preco unit. muda
3. desconto (preco fixo) → preco unit. muda
4. leve_x_pague_y → preco unit. NAO muda, desconto no subtotal
5. compra_parceira → so aplica se nao ha outra promo ativa
```

### Multiplas Regras

Quando um produto tem multiplas promos `quantidade_minima` (ex: 4+ → R$25, 10+ → R$2):
- Filtra as que a quantidade qualifica
- Ordena por `quantidadeMinima` decrescente
- Usa a melhor (maior threshold que qualifica)

### Backend (pedido-service.ts)

Processamento em dois passes:
1. **Primeiro passe:** Aplica desconto, leve_x_pague_y, quantidade_minima por item
2. **Segundo passe:** Aplica compra_parceira (precisa saber quais produtos estao no pedido)

---

## Pedidos Recorrentes

### Criacao

1. Define: cliente, dias da semana, periodo, itens
2. Gera automaticamente pedidos para cada dia valido ate `dataFim` (default: 90 dias)
3. Cada pedido gerado tem `recorrenteId` linkando ao template

### Atualizacao

1. Transacao: atualiza template + deleta pedidos pendentes + regenera novos
2. Pedidos ja entregues/cancelados nao sao afetados

### Exclusao

1. Dialog mostra pedidos pendentes vinculados
2. Usuario seleciona quais manter e quais excluir
3. API aceita `keepOrderIds` para exclusao seletiva
4. Pedidos entregues/cancelados sao desvinculados (`recorrenteId = null`)

---

## Frontend

### Paginas (18)

| Rota | Funcionalidade |
|------|----------------|
| `/resumo` | Dashboard com KPIs, comparativos, rankings |
| `/pedidos` | Lista com busca, filtros, chips, acoes em massa |
| `/pedidos/novo` | Formulario de novo pedido |
| `/pedidos/[id]` | Detalhe/edicao do pedido |
| `/clientes` | Lista com busca, edicao inline, CSV |
| `/produtos` | Lista com edicao inline |
| `/promocoes` | CRUD de promocoes (4 tipos) |
| `/contas` | Financeiro (contas, fornecedores, categorias) |
| `/recorrentes` | Tabela com colunas customizaveis, CSV |
| `/rota` | Rota de entrega com otimizacao Google Maps |
| `/entrega` | Modo entrega (tela simplificada) |
| `/separacao` | Lista de separacao/picking |
| `/fornecedores` | CRUD fornecedores |
| `/login` | Tela de login |
| `/setup` | Criacao do admin inicial |
| `/admin/usuarios` | Gestao de usuarios |
| `/admin/configuracoes` | Configuracoes do sistema |

### Componentes Compartilhados (20)

**UI Base (shadcn-style com @base-ui/react):**
Badge, Button, Card, Command, Dialog, Input, Label, Popover, Select, Separator, Sheet, Table, Textarea

**Componentes Customizados:**
- `StatusBadge` — badges de status com cores consistentes
- `TabsNav` — navegacao por tabs reutilizavel
- `EmptyState` — estado vazio com icone e CTA
- `Skeleton` / `TableSkeleton` / `CardSkeleton` — placeholders de loading
- `Breadcrumb` — navegacao breadcrumb
- `NovoPedidoSheet` — formulario de criacao de pedido (sheet lateral)

### Bibliotecas Compartilhadas (10)

| Arquivo | Conteudo |
|---------|----------|
| `api-helpers.ts` | `withAuth()`, `parseBody()`, `parseId()`, `ApiError`, `handleApiError()` |
| `schemas.ts` | 15+ schemas Zod para todas as entidades |
| `types.ts` | Interfaces TypeScript para todos os modelos |
| `constants.ts` | `PEDIDO_INCLUDE`, `RECORRENTE_INCLUDE`, status enums |
| `formatting.ts` | `formatPrice()`, `formatDate()`, `todayStr()`, `formatPhone()`, `addDays()` |
| `pedido-utils.ts` | `calcSubtotal()` para calculo de subtotal com promocoes |
| `services/pedido-service.ts` | `processOrderItems()`, `generateRecurringOrders()` |
| `config.ts` | `getConfig()`, `getGoogleRoutesApiKey()` |
| `prisma.ts` | Singleton do PrismaClient |
| `utils.ts` | `cn()` (classnames), `safeInt()` |

---

## Tema e Estilizacao

- **Framework:** Tailwind CSS 4 com variaveis oklch
- **Tema:** Apple Dark (neutro escuro, accent azul)
- **Font:** Inter (via next/font/google)
- **Responsivo:** Mobile-first com breakpoints `sm:`, `md:`
- **Tabelas mobile:** Colunas escondidas com `hidden sm:table-cell`

---

## Integracao Google Maps

**APIs utilizadas:**
1. **Google Routes API** — otimizacao de rotas de entrega
2. **Google Maps Embed API** — preview do mapa na pagina de rota
3. **Google Maps URLs** — abrir navegacao no Google Maps

**Configuracao:** Chave API armazenada no banco (tabela `configuracoes`) com fallback para env `GOOGLE_ROUTES_API_KEY`.

---

## Instalacao e Deploy

### Local (PowerShell)

```powershell
irm https://raw.githubusercontent.com/gtorige/morangos/main/install.ps1 | iex
```

O script `install.ps1` automatiza:
1. Instalacao do Node.js e Git (se necessario)
2. Clone do repositorio
3. `npm install`
4. Criacao do `.env` (DATABASE_URL + AUTH_SECRET)
5. `prisma generate` + `prisma migrate deploy`
6. Seed de dados iniciais
7. Criacao de atalho na area de trabalho

### Atualizacao

O mesmo `install.ps1` detecta instalacao existente e oferece:
1. Iniciar o app
2. Atualizar (backup → git pull → restore → npm install → prisma db push)
3. Desinstalar

**Backup seguro:** Salva em `Documentos/MorangosBackups/` antes de qualquer operacao destrutiva.

### Nuvem (Vercel + Turso) — Branch `cloud`

Deploy funcional em https://morangos-wheat.vercel.app

**Stack cloud:**
- Vercel (hosting Next.js) — plano Hobby gratuito
- Turso (SQLite remoto via libsql) — plano Starter gratuito
- Prisma 5.22 + @prisma/adapter-libsql 5.22 + @libsql/client 0.6.2

**Diferencas da branch cloud vs main:**
- `auth.config.ts` — Config Edge-safe (sem prisma) para middleware
- `auth.ts` — Config simplificada, reutiliza auth.config
- `middleware.ts` — Importa auth.config (nao auth.ts, evita libsql no Edge)
- `prisma.ts` — Adapter Turso + fetch shim para bug /v1/jobs
- `next.config.ts` — `serverExternalPackages` para libsql
- `vercel.json` — Build com `--webpack` (bug Turbopack + middleware)
- `deploy-cloud.ps1` — Script automatizado de deploy

**Workarounds documentados:**
1. `@libsql/client` 0.6.x faz probe em `/v1/jobs` que retorna 400 em AWS Turso. Shim no fetch global intercepta e retorna 400 controlado.
2. Turbopack nao gera `middleware.js.nft.json` corretamente. Build usa `--webpack`.
3. PowerShell `echo` adiciona newlines em env vars. Script usa arquivo temporario sem BOM.
4. OneDrive move Desktop para paths diferentes. Script testa multiplos candidatos.

**Instalador:** `deploy-cloud.ps1` na branch `cloud`

---

## Variaveis de Ambiente

| Variavel | Obrigatoria | Descricao |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | `file:./dev.db` (local) |
| `AUTH_SECRET` | Sim | Chave para JWT (32 chars aleatorios) |
| `GOOGLE_ROUTES_API_KEY` | Nao | Chave API Google (pode ser salva no banco) |
| `TURSO_DATABASE_URL` | Cloud | `libsql://...` (apenas branch cloud) |
| `TURSO_AUTH_TOKEN` | Cloud | Token JWT do Turso (apenas branch cloud) |

---

## Estatisticas

| Metrica | Valor |
|---------|-------|
| Linhas de codigo (src/) | ~18.000 |
| Arquivos TypeScript | ~90 |
| API routes | 42 |
| Paginas | 18 |
| Componentes | 20 |
| Modelos Prisma | 15 |
| Schemas Zod | 15+ |
| Dependencias (prod) | 17 |
| Dependencias (dev) | 10 |
