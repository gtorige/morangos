-- CreateTable subcategorias
CREATE TABLE IF NOT EXISTS "subcategorias" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "categoria_id" INTEGER NOT NULL,
    CONSTRAINT "subcategorias_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex unique on subcategorias
CREATE UNIQUE INDEX IF NOT EXISTS "subcategorias_nome_categoria_id_key" ON "subcategorias"("nome", "categoria_id");

-- Add columns to contas (for fresh installs)
ALTER TABLE "contas" ADD COLUMN "subcategoria_id" INTEGER REFERENCES "subcategorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contas" ADD COLUMN "tipo_financeiro" TEXT NOT NULL DEFAULT '';
ALTER TABLE "contas" ADD COLUMN "parcelas" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "contas" ADD COLUMN "parcela_numero" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "contas" ADD COLUMN "parcela_grupo_id" INTEGER;

-- CreateIndex on subcategoria_id in contas
CREATE INDEX IF NOT EXISTS "contas_subcategoria_id_idx" ON "contas"("subcategoria_id");
