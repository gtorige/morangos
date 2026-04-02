"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tag, Plus, Trash2 } from "lucide-react";

import type { Categoria, Subcategoria } from "@/hooks/use-contas";

interface CategoriasTabProps {
  categorias: Categoria[];
  categoriasLoading: boolean;
  subcategorias: Subcategoria[];
  // Categoria dialog
  categoriaDialogOpen: boolean;
  setCategoriaDialogOpen: (v: boolean) => void;
  categoriaNome: string;
  setCategoriaNome: (v: string) => void;
  categoriaEditingId: number | null;
  categoriaError: string;
  onCategoriaSubmit: (e: React.FormEvent) => void;
  onEditCategoria: (item: Categoria) => void;
  onDeleteCategoria: (id: number) => void;
  // Subcategoria dialog
  subcategoriaDialogOpen: boolean;
  setSubcategoriaDialogOpen: (v: boolean) => void;
  subcategoriaNome: string;
  setSubcategoriaNome: (v: string) => void;
  subcategoriaError: string;
  onNewSubcategoria: (categoriaId: number) => void;
  onSubcategoriaSubmit: (e: React.FormEvent) => void;
  onDeleteSubcategoria: (id: number) => void;
}

export function CategoriasTab({
  categorias,
  categoriasLoading,
  subcategorias,
  categoriaDialogOpen,
  setCategoriaDialogOpen,
  categoriaNome,
  setCategoriaNome,
  categoriaEditingId,
  categoriaError,
  onCategoriaSubmit,
  onEditCategoria,
  onDeleteCategoria,
  subcategoriaDialogOpen,
  setSubcategoriaDialogOpen,
  subcategoriaNome,
  setSubcategoriaNome,
  subcategoriaError,
  onNewSubcategoria,
  onSubcategoriaSubmit,
  onDeleteSubcategoria,
}: CategoriasTabProps) {
  return (
    <>
      {categoriasLoading ? (
        <TableSkeleton rows={4} cols={2} />
      ) : categorias.length === 0 ? (
        <EmptyState icon={Tag} title="Nenhuma categoria cadastrada" />
      ) : (
        <div className="space-y-3">
          {categorias.map((cat) => {
            const catSubcategorias = subcategorias.filter((s) => s.categoriaId === cat.id);
            return (
              <div key={cat.id} className="rounded-lg border p-4 space-y-3">
                <div
                  className="flex items-center justify-between"
                  onDoubleClick={() => onEditCategoria(cat)}
                  title="Duplo clique para renomear"
                >
                  <div className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="font-medium">{cat.nome}</span>
                    <Badge variant="outline" className="text-xs">{cat._count.contas} contas</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onNewSubcategoria(cat.id)}
                      title="Adicionar subcategoria"
                    >
                      <Plus className="size-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => onDeleteCategoria(cat.id)} title="Excluir">
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {catSubcategorias.length > 0 && (
                  <div className="flex flex-wrap gap-2 pl-1">
                    {catSubcategorias.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs bg-muted/30"
                      >
                        <span>{sub.nome}</span>
                        <span className="text-muted-foreground">({sub._count.contas})</span>
                        <button
                          type="button"
                          onClick={() => onDeleteSubcategoria(sub.id)}
                          className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Categoria Dialog */}
      <Dialog open={categoriaDialogOpen} onOpenChange={setCategoriaDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{categoriaEditingId ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onCategoriaSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="catNome">Nome</Label>
              <Input
                id="catNome"
                value={categoriaNome}
                onChange={(e) => setCategoriaNome(e.target.value)}
                required
                autoFocus
              />
            </div>
            {categoriaError && <p className="text-sm text-destructive">{categoriaError}</p>}
            <DialogFooter>
              <Button type="submit">{categoriaEditingId ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Subcategoria Dialog */}
      <Dialog open={subcategoriaDialogOpen} onOpenChange={setSubcategoriaDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Subcategoria</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubcategoriaSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subNome">Nome</Label>
              <Input
                id="subNome"
                value={subcategoriaNome}
                onChange={(e) => setSubcategoriaNome(e.target.value)}
                required
                autoFocus
              />
            </div>
            {subcategoriaError && <p className="text-sm text-destructive">{subcategoriaError}</p>}
            <DialogFooter>
              <Button type="submit">Criar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
