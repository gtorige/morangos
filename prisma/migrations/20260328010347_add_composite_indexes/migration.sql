-- CreateIndex
CREATE INDEX "pedidos_cliente_id_data_entrega_idx" ON "pedidos"("cliente_id", "data_entrega");

-- CreateIndex
CREATE INDEX "pedidos_recorrentes_ativo_idx" ON "pedidos_recorrentes"("ativo");

-- CreateIndex
CREATE INDEX "promocoes_ativo_data_inicio_data_fim_idx" ON "promocoes"("ativo", "data_inicio", "data_fim");
