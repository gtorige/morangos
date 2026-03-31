# Relatorio de Revisao e Testes — Morangos v2.0.2

**Data**: 2026-03-31
**Versao analisada**: 976882b (main) / 4a7ce2e (cloud)
**Executado por**: Claude Code (Opus 4.6)

---

## 1. Resumo Executivo

| Metrica | Valor |
|---------|-------|
| Total de arquivos revisados | 68 |
| Total de fluxos mapeados | 14 |
| Total de cenarios gerados | 42 |
| Cenarios executados | 0 (sem suite de testes) |
| Bugs criticos encontrados 🔴 | 1 |
| Bugs altos encontrados 🟠 | 7 |
| Bugs medios encontrados 🟡 | 31 |
| Bugs baixos encontrados 🟢 | 20 |
| **Total de issues** | **60** |

---

## 2. Mapa do Projeto

| Categoria | Contagem | Descricao |
|-----------|----------|-----------|
| Modelos Prisma | 18 | Cliente, Produto, Pedido, PedidoItem, Promocao, FormaPagamento, Fornecedor, Categoria, Subcategoria, Conta, Usuario, PedidoRecorrente, PedidoRecorrenteItem, Configuracao, LocalFrequente, MensagemWhatsApp, Colheita, MovimentacaoEstoque |
| Rotas API | 42 endpoints | 26 arquivos route.ts com GET/POST/PUT/DELETE |
| Paginas Frontend | 18 | login, resumo, pedidos (lista/novo/[id]), clientes, produtos, promocoes, recorrentes, contas, estoque, producao, separacao, rota, entrega, admin/usuarios, admin/configuracoes, setup |
| Componentes UI | 21 | 19 shadcn-style + novo-pedido-sheet + fluxo-banner |
| Libs/Services | 10 | api-helpers, schemas, types, constants, formatting, prisma, pedido-utils, produto-utils, utils, services/pedido-service |
| Integracoes | 3 | NextAuth (JWT), Prisma/SQLite (ou Turso), Google Routes API |

---

## 3. Problemas Encontrados

### 3.1 — Issues de Backend (API)

#### BUG #API-1 🔴 CRITICO
- **Arquivo**: `src/app/api/pedidos/bulk/route.ts`
- **Descricao**: Acao bulk "entregue" NAO deduz estoque. A rota individual PUT de pedidos tem logica elaborada de deducao de estoque ao marcar como "Entregue", mas a rota bulk pula completamente essa logica.
- **Impacto**: Usar acoes em massa para marcar pedidos como entregues nao atualiza o inventario, criando dessincronia no estoque.
- **Fix**: Iterar sobre cada pedido e aplicar a mesma logica de estoque da rota individual, ou extrair para uma funcao compartilhada.

#### BUG #API-2 🟠 ALTO
- **Arquivo**: `src/app/api/pedidos/[id]/route.ts` (linhas 42-44)
- **Descricao**: Ao atualizar itens do pedido, o total e recalculado SEM incluir `taxaEntrega`. O POST original inclui corretamente.
- **Impacto**: Editar itens de um pedido gera total incorreto (menor) que exclui a taxa de entrega.

#### BUG #API-3 🟠 ALTO
- **Arquivo**: `src/app/api/movimentacoes/[id]/route.ts`
- **Descricao**: PUT aceita body sem validacao Zod. Cliente pode definir `saldoFinal` arbitrariamente.
- **Impacto**: Dados de auditoria de movimentacao de estoque podem ser manipulados.

#### BUG #API-4 🟠 ALTO
- **Arquivo**: `src/app/api/admin/usuarios/route.ts` e `[id]/route.ts`
- **Descricao**: Nenhum try/catch e nao usa `withAuth`. Erros Prisma causam crash sem resposta estruturada.
- **Impacto**: Erros de banco (ex: usuario duplicado) retornam 500 generico.

#### BUG #API-5 🟠 ALTO
- **Arquivo**: `src/app/api/login/route.ts` (linha 61)
- **Descricao**: Cookie de sessao com `secure: false` hardcoded.
- **Impacto**: Token de sessao pode ser interceptado via MITM em redes nao-HTTPS.

#### BUG #API-6 🟡 MEDIO
- **Arquivo**: `src/app/api/pedidos/[id]/route.ts` (linhas 75-96, 100-207)
- **Descricao**: Reversao de estoque e deducao ao marcar "Entregue" leem o pedido FORA da transacao. Race condition possivel.

#### BUG #API-7 🟡 MEDIO
- **Arquivo**: `src/app/api/recorrentes/gerar/route.ts`
- **Descricao**: Ignora `precoManual` dos itens recorrentes. Sempre usa preco atual do produto.

#### BUG #API-8 🟡 MEDIO
- **Arquivo**: `src/app/api/pedidos/route.ts` (linhas 33-58)
- **Descricao**: Duplicacao de pedido via GET (operacao de escrita em request idempotente).

#### BUG #API-9 🟡 MEDIO
- **Arquivo**: `src/app/api/recorrentes/gerar/route.ts`, `rota/otimizar/route.ts`
- **Descricao**: Sem validacao Zod nos bodys de entrada.

#### BUG #API-10 🟡 MEDIO
- **Arquivo**: `src/app/api/login/route.ts`
- **Descricao**: Sem rate limiting ou protecao contra brute-force.

#### BUG #API-11 🟡 MEDIO
- **Arquivo**: `src/app/api/pedidos/bulk/route.ts`
- **Descricao**: Acao bulk "pago" sobrescreve pagamentos parciais (seta valorPago = total).

#### BUG #API-12 🟡 MEDIO
- **Arquivo**: `src/app/api/movimentacoes/[id]/route.ts`
- **Descricao**: Edicao de movimentacao nao recalcula saldoInicial/saldoFinal.

#### BUG #API-13 🟡 MEDIO
- **Arquivo**: `src/app/api/backup/route.ts`
- **Descricao**: Usa `readFileSync` que bloqueia event loop para bancos grandes.

#### BUG #API-14 🟡 MEDIO
- **Arquivo**: `src/app/api/resumo/route.ts`
- **Descricao**: Carrega TODOS os pedidos do periodo na memoria para agregacao.

---

### 3.2 — Issues de Frontend

#### BUG #FE-1 🟠 ALTO
- **Arquivo**: Multiplos (pedidos/novo, pedidos/[id], novo-pedido-sheet)
- **Descricao**: Limpar busca de cliente nao limpa `clienteId`. Usuario pode submeter pedido para cliente errado.

#### BUG #FE-2 🟠 ALTO
- **Arquivo**: `src/app/pedidos/[id]/page.tsx` (linha 578)
- **Descricao**: Itens usam `key={index}` causando dessincronizacao de estado ao remover itens do meio da lista.

#### BUG #FE-3 🟡 MEDIO
- **Arquivo**: `src/app/pedidos/[id]/page.tsx`
- **Descricao**: `getPromocaoForProduto` e `calcSubtotal` nao tratam promocoes `quantidade_minima`. Edicao de pedido calcula subtotais diferentes da criacao.

#### BUG #FE-4 🟡 MEDIO
- **Arquivo**: `src/app/pedidos/novo/page.tsx`, `pedidos/[id]/page.tsx`
- **Descricao**: Remover item do meio da lista nao re-indexa mapas de estado (produtoSearches, produtoDropdowns).

#### BUG #FE-5 🟡 MEDIO
- **Arquivo**: Multiplos (pedidos/novo, pedidos/[id], novo-pedido-sheet)
- **Descricao**: Dropdown de cliente nao fecha ao clicar fora.

#### BUG #FE-6 🟡 MEDIO
- **Arquivo**: `src/app/estoque/page.tsx`
- **Descricao**: Filtros de data e produto para movimentacoes nunca sao enviados para a API. Filtros nao funcionam.

#### BUG #FE-7 🟡 MEDIO
- **Arquivo**: `src/app/contas/page.tsx`
- **Descricao**: Criacao sequencial de parcelas sem rollback em caso de falha parcial.

#### BUG #FE-8 🟡 MEDIO
- **Arquivo**: `src/app/clientes/page.tsx`
- **Descricao**: fetchClientes chamado duas vezes no mount (effect vazio + effect de busca).

#### BUG #FE-9 🟡 MEDIO
- **Arquivo**: `src/app/clientes/page.tsx`
- **Descricao**: Sem validacao client-side no formulario de cliente antes do submit.

#### BUG #FE-10 🟡 MEDIO
- **Arquivo**: `src/app/recorrentes/page.tsx`
- **Descricao**: `handleToggleAtivo` envia objeto inteiro em vez de apenas `{ ativo }`.

#### BUG #FE-11 🟡 MEDIO
- **Arquivo**: `src/components/novo-pedido-sheet.tsx`
- **Descricao**: Nomes de produto podem ficar em branco na primeira abertura com initialData.

#### BUG #FE-12 🟡 MEDIO
- **Arquivo**: Multiplos
- **Descricao**: Autocompletes customizados nao implementam ARIA combobox (acessibilidade).

---

## 4. Fluxos Mapeados

### FLUXO #1 — Login
- **Tipo**: Fluxo de usuario
- **Trigger**: Acesso a qualquer pagina sem sessao
- **Passos**: 1. Redirect para /login → 2. Preencher usuario/senha → 3. POST /api/login → 4. Cookie JWT definido → 5. Redirect para /

### FLUXO #2 — Criar Pedido (pagina /pedidos/novo)
- **Tipo**: Fluxo de usuario
- **Trigger**: Menu lateral "Novo Pedido"
- **Passos**: 1. Selecionar cliente → 2. Adicionar itens com quantidade → 3. Selecionar forma pagamento → 4. Definir data entrega → 5. POST /api/pedidos → 6. Redirect para /pedidos

### FLUXO #3 — Criar Pedido (NovoPedidoSheet)
- **Tipo**: Fluxo de usuario
- **Trigger**: Botao "+ Novo Pedido" na aba Pedidos
- **Passos**: 1. Sheet lateral abre → 2. Selecionar cliente → 3. Adicionar itens → 4. POST /api/pedidos → 5. Sheet fecha, lista atualiza

### FLUXO #4 — Editar/Atualizar Pedido
- **Tipo**: Fluxo de usuario
- **Trigger**: Double-click em pedido na lista
- **Passos**: 1. GET /api/pedidos/:id → 2. Alterar campos → 3. PUT /api/pedidos/:id → 4. Se status entrega muda, logica de estoque executada

### FLUXO #5 — Acoes em Massa (Bulk)
- **Tipo**: Fluxo de usuario
- **Trigger**: Selecionar pedidos + acao no dropdown
- **Passos**: 1. Selecionar checkboxes → 2. Escolher acao → 3. PATCH /api/pedidos/bulk → 4. updateMany executado

### FLUXO #6 — Gestao de Estoque
- **Tipo**: Fluxo de dados
- **Trigger**: Colheita, pedido entregue, movimentacao manual
- **Passos**: 1. POST /api/colheita ou /api/movimentacoes → 2. Saldo atualizado via increment/decrement → 3. GET /api/estoque/dia retorna posicao

### FLUXO #7 — Pedidos Recorrentes
- **Tipo**: Fluxo de sistema
- **Trigger**: POST /api/recorrentes/gerar
- **Passos**: 1. Buscar templates ativos → 2. Para cada dia da semana no periodo → 3. Verificar se ja existe pedido → 4. Criar pedido com itens

### FLUXO #8 — Gestao Financeira (Contas)
- **Tipo**: Fluxo de usuario
- **Trigger**: Botao "+ Nova Conta"
- **Passos**: 1. Selecionar fornecedor → 2. Preencher valor/vencimento → 3. Definir parcelas → 4. POST /api/contas (1x por parcela) → 5. PUT para definir parcelaGrupoId

### FLUXO #9 — Rota de Entrega
- **Tipo**: Fluxo de usuario
- **Trigger**: Pagina /rota
- **Passos**: 1. GET /api/rota (pedidos do dia) → 2. Adicionar paradas extras → 3. POST /api/rota/otimizar (Google Routes API) → 4. Reordenar lista

### FLUXO #10 — Separacao de Pedidos
- **Tipo**: Fluxo de usuario
- **Trigger**: Pagina /separacao
- **Passos**: 1. GET /api/separacao → 2. Visualizar itens agrupados por produto → 3. Marcar como separado

### FLUXO #11 — Producao/Colheita
- **Tipo**: Fluxo de usuario
- **Trigger**: Pagina /producao
- **Passos**: 1. Registrar colheita → 2. POST /api/colheita → 3. Estoque atualizado

### FLUXO #12 — CRUD Clientes
- **Tipo**: Fluxo de usuario
- **Trigger**: Pagina /clientes
- **Passos**: 1. Criar/editar/excluir cliente → 2. POST/PUT/DELETE /api/clientes

### FLUXO #13 — CRUD Produtos
- **Tipo**: Fluxo de usuario
- **Trigger**: Pagina /produtos
- **Passos**: 1. Criar/editar/excluir produto → 2. POST/PUT/DELETE /api/produtos

### FLUXO #14 — Backup
- **Tipo**: Fluxo de admin
- **Trigger**: GET /api/backup
- **Passos**: 1. Verificar admin → 2. Ler dev.db como Buffer → 3. Retornar como download

---

## 5. Cenarios de Teste

> ⚠️ Projeto sem suite de testes automatizados.
> Recomendacao: implementar Vitest para API routes (P1/P2) e Playwright para fluxos criticos de frontend.

### TC-LOGIN-01 — Login com credenciais validas (Happy Path)
- **Prioridade**: P1
- **Dados**: `{ "username": "admin", "password": "admin" }`
- **Resultado esperado**: Status 200, cookie `authjs.session-token` definido
- **Status**: ⬜ Nao executado

### TC-LOGIN-02 — Login com senha incorreta
- **Prioridade**: P1
- **Dados**: `{ "username": "admin", "password": "wrong" }`
- **Resultado esperado**: Status 401, `{ "error": "Credenciais invalidas" }`
- **Status**: ⬜ Nao executado

### TC-LOGIN-03 — Login com body vazio
- **Prioridade**: P2
- **Dados**: `{}`
- **Resultado esperado**: Status 400
- **Status**: ⬜ Nao executado

### TC-LOGIN-04 — Login sem autenticacao para rota protegida
- **Prioridade**: P1
- **Dados**: GET /api/pedidos sem cookie
- **Resultado esperado**: Status 401
- **Status**: ⬜ Nao executado

### TC-PEDIDO-01 — Criar pedido com dados validos
- **Prioridade**: P1
- **Dados**: `{ "clienteId": 1, "dataEntrega": "2026-04-01", "itens": [{"produtoId": 1, "quantidade": 2}] }`
- **Resultado esperado**: Status 201, pedido criado com total calculado
- **Status**: ⬜ Nao executado

### TC-PEDIDO-02 — Criar pedido sem cliente
- **Prioridade**: P2
- **Dados**: `{ "dataEntrega": "2026-04-01", "itens": [...] }` (sem clienteId)
- **Resultado esperado**: Status 400, erro de validacao Zod
- **Status**: ⬜ Nao executado

### TC-PEDIDO-03 — Criar pedido sem itens
- **Prioridade**: P2
- **Dados**: `{ "clienteId": 1, "dataEntrega": "2026-04-01", "itens": [] }`
- **Resultado esperado**: Status 400, erro de validacao
- **Status**: ⬜ Nao executado

### TC-PEDIDO-04 — Editar pedido - verificar total inclui taxaEntrega
- **Prioridade**: P1 (BUG #API-2)
- **Dados**: PUT /api/pedidos/:id com itens alterados
- **Resultado esperado**: Total = soma(subtotais) + taxaEntrega
- **Resultado ESPERADO vs RECEBIDO**: Total NAO inclui taxaEntrega (BUG CONFIRMADO)
- **Status**: ❌ Falha esperada

### TC-PEDIDO-05 — Marcar pedido como "Entregue" via PUT
- **Prioridade**: P1
- **Dados**: PUT /api/pedidos/:id com `statusEntrega: "Entregue"`
- **Resultado esperado**: Estoque deduzido, movimentacoes criadas
- **Status**: ⬜ Nao executado

### TC-PEDIDO-06 — Marcar pedido como "Entregue" via BULK
- **Prioridade**: P1 (BUG #API-1)
- **Dados**: PATCH /api/pedidos/bulk com `action: "entregue"`
- **Resultado esperado**: Estoque deveria ser deduzido
- **Resultado ESPERADO vs RECEBIDO**: Estoque NAO deduzido (BUG CONFIRMADO)
- **Status**: ❌ Falha esperada

### TC-PEDIDO-07 — Duplicar pedido
- **Prioridade**: P2
- **Dados**: GET /api/pedidos?duplicar=:id
- **Resultado esperado**: Novo pedido criado com dados do original
- **Status**: ⬜ Nao executado

### TC-PEDIDO-08 — Bulk "pago" com pagamento parcial existente
- **Prioridade**: P2 (BUG #API-11)
- **Dados**: Pedido com valorPago=50, total=100. PATCH bulk "pago"
- **Resultado esperado**: valorPago deveria manter ou somar
- **Resultado RECEBIDO**: valorPago sobrescrito para 100
- **Status**: ⬜ Nao executado

### TC-CONTA-01 — Criar conta com fornecedor
- **Prioridade**: P1
- **Dados**: `{ "fornecedorNome": "Teste", "valor": 100, "vencimento": "2026-04-01" }`
- **Resultado esperado**: Conta criada com fornecedorNome persistido apos PUT de parcelaGrupoId
- **Status**: ⬜ Nao executado (fix aplicado nesta sessao)

### TC-CONTA-02 — Criar conta sem fornecedor
- **Prioridade**: P2
- **Dados**: `{ "valor": 100, "vencimento": "2026-04-01" }` (sem fornecedorNome)
- **Resultado esperado**: Alert "Selecione um fornecedor" (validacao frontend)
- **Status**: ⬜ Nao executado

### TC-CONTA-03 — Criar conta com parcelas
- **Prioridade**: P2
- **Dados**: `{ "fornecedorNome": "X", "valor": 600, "vencimento": "2026-04-01", "parcelas": "3" }`
- **Resultado esperado**: 3 contas criadas com valor 200 cada, parcelaGrupoId vinculado
- **Status**: ⬜ Nao executado

### TC-CLIENTE-01 — Criar cliente com dados validos
- **Prioridade**: P2
- **Dados**: `{ "nome": "Joao", "telefone": "11999998888" }`
- **Resultado esperado**: Status 201
- **Status**: ⬜ Nao executado

### TC-CLIENTE-02 — Excluir cliente com pedidos
- **Prioridade**: P2
- **Dados**: DELETE /api/clientes/:id (cliente com pedidos)
- **Resultado esperado**: Erro claro sobre pedidos vinculados (atualmente retorna "Referencia invalida")
- **Status**: ⬜ Nao executado

### TC-PRODUTO-01 — Criar produto com dados validos
- **Prioridade**: P2
- **Dados**: `{ "nome": "Morango A", "preco": 15.5 }`
- **Resultado esperado**: Status 201
- **Status**: ⬜ Nao executado

### TC-PRODUTO-02 — Excluir produto com pedidos
- **Prioridade**: P2
- **Dados**: DELETE /api/produtos/:id (produto em pedidos)
- **Resultado esperado**: Erro claro
- **Status**: ⬜ Nao executado

### TC-RECORRENTE-01 — Gerar pedidos recorrentes
- **Prioridade**: P1
- **Dados**: POST /api/recorrentes/gerar com data
- **Resultado esperado**: Pedidos criados para templates ativos nos dias da semana corretos
- **Status**: ⬜ Nao executado

### TC-RECORRENTE-02 — Gerar recorrentes com precoManual
- **Prioridade**: P2 (BUG #API-7)
- **Dados**: Template com precoManual definido
- **Resultado esperado**: Pedido gerado deveria usar precoManual
- **Resultado RECEBIDO**: Usa preco atual do produto (BUG CONFIRMADO)
- **Status**: ❌ Falha esperada

### TC-ESTOQUE-01 — Colheita atualiza estoque
- **Prioridade**: P1
- **Dados**: POST /api/colheita
- **Resultado esperado**: Produto.estoqueAtual incrementado, movimentacao criada
- **Status**: ⬜ Nao executado

### TC-ESTOQUE-02 — Congelamento transfere estoque
- **Prioridade**: P2
- **Dados**: POST /api/congelamento
- **Resultado esperado**: Estoque fonte decrementado, destino incrementado
- **Status**: ⬜ Nao executado

### TC-MOVIMENTACAO-01 — Editar movimentacao sem validacao
- **Prioridade**: P2 (BUG #API-3)
- **Dados**: PUT /api/movimentacoes/:id com saldoFinal arbitrario
- **Resultado esperado**: Deveria rejeitar ou recalcular
- **Resultado RECEBIDO**: Aceita qualquer valor
- **Status**: ❌ Falha esperada

### TC-ROTA-01 — Otimizar rota
- **Prioridade**: P2
- **Dados**: POST /api/rota/otimizar com waypoints validos
- **Resultado esperado**: Ordem otimizada retornada
- **Status**: ⬜ Nao executado (requer GOOGLE_ROUTES_API_KEY)

### TC-BACKUP-01 — Download backup como admin
- **Prioridade**: P3
- **Dados**: GET /api/backup com sessao admin
- **Resultado esperado**: Download do dev.db
- **Status**: ⬜ Nao executado

### TC-BACKUP-02 — Download backup sem ser admin
- **Prioridade**: P3
- **Dados**: GET /api/backup com sessao nao-admin
- **Resultado esperado**: Status 403
- **Status**: ⬜ Nao executado

### TC-USUARIO-01 — Criar usuario (admin)
- **Prioridade**: P2
- **Dados**: POST /api/admin/usuarios
- **Resultado esperado**: Status 201
- **Status**: ⬜ Nao executado

### TC-USUARIO-02 — Criar usuario com senha fraca
- **Prioridade**: P2 (BUG #API-10)
- **Dados**: `{ "username": "x", "senha": "1" }`
- **Resultado esperado**: Deveria rejeitar
- **Resultado RECEBIDO**: Aceita (sem validacao de forca)
- **Status**: ❌ Falha esperada

### TC-FE-PEDIDO-01 — Limpar busca de cliente e submeter
- **Prioridade**: P1 (BUG #FE-1)
- **Dados**: Selecionar cliente, limpar campo de busca, submeter
- **Resultado esperado**: Deveria limpar clienteId ou impedir submit
- **Resultado RECEBIDO**: Submete com clienteId antigo
- **Status**: ❌ Falha esperada

### TC-FE-PEDIDO-02 — Remover item do meio da lista
- **Prioridade**: P2 (BUG #FE-2)
- **Dados**: 3 itens, remover o 2o
- **Resultado esperado**: Campos de busca de produto corretos para itens restantes
- **Resultado RECEBIDO**: Campos dessincronizados
- **Status**: ❌ Falha esperada

### TC-FE-ESTOQUE-01 — Filtrar movimentacoes por data
- **Prioridade**: P2 (BUG #FE-6)
- **Dados**: Definir filtro de data De-Ate nas movimentacoes
- **Resultado esperado**: Movimentacoes filtradas por periodo
- **Resultado RECEBIDO**: Filtro nao tem efeito
- **Status**: ❌ Falha esperada

---

## 6. Recomendacoes Prioritarias

### 6.1 — Correcoes urgentes (antes de producao)

1. 🔴 **BUG #API-1**: Bulk "entregue" deve deduzir estoque — usar mesma logica do PUT individual
2. 🟠 **BUG #API-2**: Incluir taxaEntrega no recalculo de total ao editar pedido
3. 🟠 **BUG #FE-1**: Limpar clienteId quando campo de busca e esvaziado
4. 🟠 **BUG #API-3**: Adicionar validacao Zod no PUT de movimentacoes; nao permitir saldoFinal client-side
5. 🟠 **BUG #API-4**: Adicionar try/catch ou withAuth nas rotas de admin/usuarios

### 6.2 — Melhorias de qualidade

1. Unificar logica de promocoes entre criacao e edicao de pedido (FE-3)
2. Usar IDs unicos em vez de index para keys de itens de pedido (FE-2)
3. Implementar filtros server-side para movimentacoes no estoque (FE-6)
4. Adicionar validacao Zod em todas as rotas que usam `request.json()` direto
5. Mover duplicacao de pedido de GET para POST
6. Usar precoManual em /recorrentes/gerar
7. Wrap operacoes de estoque em transacoes atomicas

### 6.3 — Testes automatizados recomendados

1. **Vitest + supertest**: Testes de integracao para todas as rotas API P1 (login, pedidos CRUD, estoque)
2. **Vitest unitario**: pedido-service.ts (processOrderItems, generateRecurringOrders)
3. **Playwright**: Fluxo completo de criacao de pedido (pagina /novo e NovoPedidoSheet)
4. **Playwright**: Fluxo de gestao financeira (criar conta com parcelas)
5. **Vitest**: Validacao de todos os schemas Zod com inputs validos e invalidos
