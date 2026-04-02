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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Store, Trash2, Download } from "lucide-react";

import type { Fornecedor } from "@/hooks/use-contas";

interface FornecedoresTabProps {
  fornecedores: Fornecedor[];
  fornecedoresLoading: boolean;
  fornecedorDialogOpen: boolean;
  setFornecedorDialogOpen: (v: boolean) => void;
  fornecedorNome: string;
  setFornecedorNome: (v: string) => void;
  fornecedorEditingId: number | null;
  fornecedorError: string;
  onFornecedorSubmit: (e: React.FormEvent) => void;
  onEditFornecedor: (item: Fornecedor) => void;
  onDeleteFornecedor: (id: number) => void;
  exportFornecedoresCSV: () => void;
}

export function FornecedoresTab({
  fornecedores,
  fornecedoresLoading,
  fornecedorDialogOpen,
  setFornecedorDialogOpen,
  fornecedorNome,
  setFornecedorNome,
  fornecedorEditingId,
  fornecedorError,
  onFornecedorSubmit,
  onEditFornecedor,
  onDeleteFornecedor,
  exportFornecedoresCSV,
}: FornecedoresTabProps) {
  return (
    <>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportFornecedoresCSV} className="h-9 gap-1.5">
          <Download className="size-4" />
          <span className="hidden sm:inline">CSV</span>
        </Button>
      </div>
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="text-center">Contas</TableHead>
              <TableHead className="text-right">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fornecedoresLoading ? (
              <TableRow>
                <TableCell colSpan={3}>
                  <TableSkeleton rows={4} cols={3} />
                </TableCell>
              </TableRow>
            ) : fornecedores.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3}>
                  <EmptyState icon={Store} title="Nenhum fornecedor cadastrado" />
                </TableCell>
              </TableRow>
            ) : (
              fornecedores.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer transition-colors"
                  onDoubleClick={() => onEditFornecedor(item)}
                >
                  <TableCell className="font-medium">{item.nome}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{item._count.contas}</Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => onDeleteFornecedor(item.id)} title="Excluir">
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Fornecedor Dialog */}
      <Dialog open={fornecedorDialogOpen} onOpenChange={setFornecedorDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{fornecedorEditingId ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onFornecedorSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={fornecedorNome}
                onChange={(e) => setFornecedorNome(e.target.value)}
                required
                autoFocus
              />
            </div>
            {fornecedorError && <p className="text-sm text-destructive">{fornecedorError}</p>}
            <DialogFooter>
              <Button type="submit">{fornecedorEditingId ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
