-- CreateTable
CREATE TABLE "locais_frequentes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "plus_code" TEXT NOT NULL DEFAULT ''
);
