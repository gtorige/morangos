-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_clientes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL DEFAULT '',
    "rua" TEXT NOT NULL DEFAULT '',
    "numero" TEXT NOT NULL DEFAULT '',
    "bairro" TEXT NOT NULL DEFAULT '',
    "cidade" TEXT NOT NULL DEFAULT '',
    "endereco_alternativo" TEXT NOT NULL DEFAULT '',
    "observacoes" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_clientes" ("bairro", "cidade", "id", "nome", "numero", "observacoes", "rua", "telefone") SELECT "bairro", "cidade", "id", "nome", "numero", "observacoes", "rua", "telefone" FROM "clientes";
DROP TABLE "clientes";
ALTER TABLE "new_clientes" RENAME TO "clientes";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
