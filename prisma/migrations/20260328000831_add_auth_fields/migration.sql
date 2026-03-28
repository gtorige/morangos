/*
  Warnings:

  - You are about to drop the column `fornecedor` on the `contas` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `usuarios` table. All the data in the column will be lost.
  - Added the required column `username` to the `usuarios` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "fornecedores" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "pedidos_recorrentes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cliente_id" INTEGER NOT NULL,
    "forma_pagamento_id" INTEGER,
    "dias_semana" TEXT NOT NULL,
    "data_inicio" TEXT NOT NULL,
    "data_fim" TEXT,
    "taxa_entrega" REAL NOT NULL DEFAULT 0,
    "observacoes" TEXT NOT NULL DEFAULT '',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "pedidos_recorrentes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pedidos_recorrentes_forma_pagamento_id_fkey" FOREIGN KEY ("forma_pagamento_id") REFERENCES "formas_pagamento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pedido_recorrente_itens" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pedido_recorrente_id" INTEGER NOT NULL,
    "produto_id" INTEGER NOT NULL,
    "quantidade" REAL NOT NULL,
    "preco_manual" REAL,
    CONSTRAINT "pedido_recorrente_itens_pedido_recorrente_id_fkey" FOREIGN KEY ("pedido_recorrente_id") REFERENCES "pedidos_recorrentes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pedido_recorrente_itens_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_contas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fornecedor_id" INTEGER,
    "fornecedor_nome" TEXT NOT NULL DEFAULT '',
    "categoria" TEXT NOT NULL DEFAULT '',
    "valor" REAL NOT NULL,
    "vencimento" TEXT NOT NULL,
    "situacao" TEXT NOT NULL DEFAULT 'Pendente',
    CONSTRAINT "contas_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_contas" ("categoria", "id", "situacao", "valor", "vencimento") SELECT "categoria", "id", "situacao", "valor", "vencimento" FROM "contas";
DROP TABLE "contas";
ALTER TABLE "new_contas" RENAME TO "contas";
CREATE INDEX "contas_fornecedor_id_idx" ON "contas"("fornecedor_id");
CREATE TABLE "new_pedidos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cliente_id" INTEGER NOT NULL,
    "data_pedido" TEXT NOT NULL,
    "data_entrega" TEXT NOT NULL,
    "forma_pagamento_id" INTEGER,
    "total" REAL NOT NULL DEFAULT 0,
    "valor_pago" REAL NOT NULL DEFAULT 0,
    "situacao_pagamento" TEXT NOT NULL DEFAULT 'Pendente',
    "status_entrega" TEXT NOT NULL DEFAULT 'Pendente',
    "taxa_entrega" REAL NOT NULL DEFAULT 0,
    "ordem_rota" INTEGER,
    "observacoes" TEXT NOT NULL DEFAULT '',
    "recorrente_id" INTEGER,
    CONSTRAINT "pedidos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "pedidos_forma_pagamento_id_fkey" FOREIGN KEY ("forma_pagamento_id") REFERENCES "formas_pagamento" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "pedidos_recorrente_id_fkey" FOREIGN KEY ("recorrente_id") REFERENCES "pedidos_recorrentes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_pedidos" ("cliente_id", "data_entrega", "data_pedido", "forma_pagamento_id", "id", "observacoes", "ordem_rota", "situacao_pagamento", "status_entrega", "total", "valor_pago") SELECT "cliente_id", "data_entrega", "data_pedido", "forma_pagamento_id", "id", "observacoes", "ordem_rota", "situacao_pagamento", "status_entrega", "total", "valor_pago" FROM "pedidos";
DROP TABLE "pedidos";
ALTER TABLE "new_pedidos" RENAME TO "pedidos";
CREATE INDEX "pedidos_cliente_id_idx" ON "pedidos"("cliente_id");
CREATE INDEX "pedidos_data_entrega_idx" ON "pedidos"("data_entrega");
CREATE TABLE "new_promocoes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "produto_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'desconto',
    "preco_promocional" REAL NOT NULL DEFAULT 0,
    "leve_quantidade" INTEGER,
    "pague_quantidade" INTEGER,
    "data_inicio" TEXT NOT NULL,
    "data_fim" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "promocoes_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_promocoes" ("ativo", "data_fim", "data_inicio", "id", "nome", "preco_promocional", "produto_id") SELECT "ativo", "data_fim", "data_inicio", "id", "nome", "preco_promocional", "produto_id" FROM "promocoes";
DROP TABLE "promocoes";
ALTER TABLE "new_promocoes" RENAME TO "promocoes";
CREATE INDEX "promocoes_produto_id_idx" ON "promocoes"("produto_id");
CREATE TABLE "new_usuarios" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "nome" TEXT NOT NULL DEFAULT '',
    "senha" TEXT NOT NULL,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_usuarios" ("id", "senha") SELECT "id", "senha" FROM "usuarios";
DROP TABLE "usuarios";
ALTER TABLE "new_usuarios" RENAME TO "usuarios";
CREATE UNIQUE INDEX "usuarios_username_key" ON "usuarios"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "fornecedores_nome_key" ON "fornecedores"("nome");

-- CreateIndex
CREATE INDEX "pedidos_recorrentes_cliente_id_idx" ON "pedidos_recorrentes"("cliente_id");

-- CreateIndex
CREATE INDEX "pedido_recorrente_itens_pedido_recorrente_id_idx" ON "pedido_recorrente_itens"("pedido_recorrente_id");

-- CreateIndex
CREATE INDEX "pedido_itens_pedido_id_idx" ON "pedido_itens"("pedido_id");

-- CreateIndex
CREATE INDEX "pedido_itens_produto_id_idx" ON "pedido_itens"("produto_id");
