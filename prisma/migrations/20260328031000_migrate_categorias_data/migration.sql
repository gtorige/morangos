-- Migrate existing free-text categories to the categorias table
-- Step 1: Insert distinct non-empty category names into categorias table
INSERT OR IGNORE INTO "categorias" ("nome")
SELECT DISTINCT "categoria" FROM "contas"
WHERE "categoria" IS NOT NULL AND "categoria" != '' AND TRIM("categoria") != '';

-- Step 2: Link existing contas to their matching categoria by name
UPDATE "contas"
SET "categoria_id" = (
  SELECT "id" FROM "categorias" WHERE "categorias"."nome" = "contas"."categoria"
)
WHERE "categoria" IS NOT NULL AND "categoria" != '' AND TRIM("categoria") != ''
AND "categoria_id" IS NULL;
