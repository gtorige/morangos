-- Seed formas de pagamento (only inserts if table is empty)
INSERT INTO "formas_pagamento" ("id", "nome") SELECT 1, 'Dinheiro' WHERE NOT EXISTS (SELECT 1 FROM "formas_pagamento" WHERE "id" = 1);
INSERT INTO "formas_pagamento" ("id", "nome") SELECT 2, 'Pix' WHERE NOT EXISTS (SELECT 1 FROM "formas_pagamento" WHERE "id" = 2);
