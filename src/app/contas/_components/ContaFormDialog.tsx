"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatPrice } from "@/lib/formatting";

import type { Conta, Categoria, Subcategoria, ContaForm } from "@/hooks/use-contas";

interface GrupoEditForm {
  fornecedorNome: string;
  categoriaId: string;
  subcategoriaId: string;
  tipoFinanceiro: string;
}

interface ContaFormDialogProps {
  // Conta dialog
  contaDialogOpen: boolean;
  setContaDialogOpen: (v: boolean) => void;
  contaForm: ContaForm;
  setContaForm: (v: ContaForm) => void;
  contaEditingId: number | null;
  onContaSubmit: (e: React.FormEvent) => void;
  fornecedorNames: string[];
  categorias: Categoria[];
  subcategorias: Subcategoria[];
  // Grupo edit dialog
  grupoEditOpen: boolean;
  setGrupoEditOpen: (v: boolean) => void;
  grupoEditForm: GrupoEditForm;
  setGrupoEditForm: (v: GrupoEditForm) => void;
  onGrupoEditSubmit: (e: React.FormEvent) => void;
}

const selectClass = "flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50";

export function ContaFormDialog({
  contaDialogOpen,
  setContaDialogOpen,
  contaForm,
  setContaForm,
  contaEditingId,
  onContaSubmit,
  fornecedorNames,
  categorias,
  subcategorias,
  grupoEditOpen,
  setGrupoEditOpen,
  grupoEditForm,
  setGrupoEditForm,
  onGrupoEditSubmit,
}: ContaFormDialogProps) {
  return (
    <>
      {/* Conta Dialog */}
      <Dialog open={contaDialogOpen} onOpenChange={setContaDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{contaEditingId ? "Editar Conta" : "Nova Conta"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onContaSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fornecedor">Fornecedor</Label>
              <select
                id="fornecedor"
                value={contaForm.fornecedorNome}
                onChange={(e) => setContaForm({ ...contaForm, fornecedorNome: e.target.value })}
                className={selectClass}
                required
              >
                <option value="">Selecione...</option>
                {fornecedorNames.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <select
                id="categoria"
                value={contaForm.categoriaId}
                onChange={(e) => setContaForm({ ...contaForm, categoriaId: e.target.value, subcategoriaId: "" })}
                className={selectClass}
              >
                <option value="">Sem categoria</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            {contaForm.categoriaId && (
              <div className="space-y-2">
                <Label htmlFor="subcategoriaId">Subcategoria</Label>
                <select
                  id="subcategoriaId"
                  value={contaForm.subcategoriaId}
                  onChange={(e) => setContaForm({ ...contaForm, subcategoriaId: e.target.value })}
                  className={selectClass}
                >
                  <option value="">Sem subcategoria</option>
                  {subcategorias
                    .filter((s) => s.categoriaId === Number(contaForm.categoriaId))
                    .map((s) => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="tipoFinanceiro">Tipo Financeiro</Label>
              <select
                id="tipoFinanceiro"
                value={contaForm.tipoFinanceiro}
                onChange={(e) => setContaForm({ ...contaForm, tipoFinanceiro: e.target.value })}
                className={selectClass}
              >
                <option value="">Sem classificacao</option>
                <option value="CAPEX">CAPEX (Investimento)</option>
                <option value="OPEX">OPEX (Operacional)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="valor">{contaEditingId ? "Valor" : "Valor total"}</Label>
                <Input
                  id="valor"
                  type="number"
                  step="0.01"
                  min="0"
                  value={contaForm.valor}
                  onChange={(e) => setContaForm({ ...contaForm, valor: e.target.value })}
                  required
                />
              </div>
              {!contaEditingId && (
                <div className="space-y-2">
                  <Label htmlFor="parcelas">Parcelas</Label>
                  <select
                    id="parcelas"
                    value={contaForm.parcelas}
                    onChange={(e) => setContaForm({ ...contaForm, parcelas: e.target.value })}
                    className={selectClass}
                  >
                    <option value="1">A vista (1x)</option>
                    <option value="2">2x</option>
                    <option value="3">3x</option>
                    <option value="4">4x</option>
                    <option value="5">5x</option>
                    <option value="6">6x</option>
                    <option value="12">12x</option>
                    <option value="24">24x</option>
                  </select>
                </div>
              )}
            </div>
            {!contaEditingId && parseInt(contaForm.parcelas) > 1 && contaForm.valor && (
              <p className="text-xs text-muted-foreground -mt-2">
                {contaForm.parcelas}x de {formatPrice(parseFloat(contaForm.valor) / parseInt(contaForm.parcelas))} {"\u2014"} 1a parcela no vencimento escolhido
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="vencimento">
                {parseInt(contaForm.parcelas) > 1 ? "Vencimento da 1a parcela" : "Vencimento"}
              </Label>
              <Input
                id="vencimento"
                type="date"
                value={contaForm.vencimento}
                onChange={(e) => setContaForm({ ...contaForm, vencimento: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Situacao</Label>
              <select
                value={contaForm.situacao}
                onChange={(e) => setContaForm({ ...contaForm, situacao: e.target.value })}
                className={selectClass}
              >
                <option value="Pendente">Pendente</option>
                <option value="Pago">Pago</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="submit">{contaEditingId ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Group Edit Dialog */}
      <Dialog open={grupoEditOpen} onOpenChange={setGrupoEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Grupo de Parcelas</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Edita os dados comuns de todas as parcelas do grupo.
          </p>
          <form onSubmit={onGrupoEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Input
                list="grupo-forn-suggestions"
                value={grupoEditForm.fornecedorNome}
                onChange={(e) => setGrupoEditForm({ ...grupoEditForm, fornecedorNome: e.target.value })}
                required
              />
              <datalist id="grupo-forn-suggestions">
                {fornecedorNames.map((s) => (<option key={s} value={s} />))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <select
                value={grupoEditForm.categoriaId}
                onChange={(e) => setGrupoEditForm({ ...grupoEditForm, categoriaId: e.target.value, subcategoriaId: "" })}
                className={selectClass}
              >
                <option value="">Sem categoria</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            {grupoEditForm.categoriaId && (
              <div className="space-y-2">
                <Label>Subcategoria</Label>
                <select
                  value={grupoEditForm.subcategoriaId}
                  onChange={(e) => setGrupoEditForm({ ...grupoEditForm, subcategoriaId: e.target.value })}
                  className={selectClass}
                >
                  <option value="">Sem subcategoria</option>
                  {subcategorias
                    .filter((s) => s.categoriaId === Number(grupoEditForm.categoriaId))
                    .map((s) => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Tipo Financeiro</Label>
              <select
                value={grupoEditForm.tipoFinanceiro}
                onChange={(e) => setGrupoEditForm({ ...grupoEditForm, tipoFinanceiro: e.target.value })}
                className={selectClass}
              >
                <option value="">Sem classificacao</option>
                <option value="CAPEX">CAPEX (Investimento)</option>
                <option value="OPEX">OPEX (Operacional)</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setGrupoEditOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar Grupo</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
