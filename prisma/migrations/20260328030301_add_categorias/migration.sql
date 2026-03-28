-- CreateTable
CREATE TABLE "categorias" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_contas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fornecedor_id" INTEGER,
    "fornecedor_nome" TEXT NOT NULL DEFAULT '',
    "categoria" TEXT NOT NULL DEFAULT '',
    "categoria_id" INTEGER,
    "valor" REAL NOT NULL,
    "vencimento" TEXT NOT NULL,
    "situacao" TEXT NOT NULL DEFAULT 'Pendente',
    CONSTRAINT "contas_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "contas_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_contas" ("categoria", "fornecedor_id", "fornecedor_nome", "id", "situacao", "valor", "vencimento") SELECT "categoria", "fornecedor_id", "fornecedor_nome", "id", "situacao", "valor", "vencimento" FROM "contas";
DROP TABLE "contas";
ALTER TABLE "new_contas" RENAME TO "contas";
CREATE INDEX "contas_fornecedor_id_idx" ON "contas"("fornecedor_id");
CREATE INDEX "contas_categoria_id_idx" ON "contas"("categoria_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "categorias_nome_key" ON "categorias"("nome");
