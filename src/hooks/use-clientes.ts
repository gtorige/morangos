import { useState, useCallback, useEffect } from "react";
import type { Cliente } from "@/lib/types";
import { useCrud } from "./use-crud";

const emptyForm = {
  nome: "",
  telefone: "",
  cep: "",
  rua: "",
  numero: "",
  bairro: "",
  cidade: "",
  enderecoAlternativo: "",
  observacoes: "",
};

type ClienteForm = typeof emptyForm;

/**
 * Hook for managing clients: fetch, search, CRUD, inline edit, CEP lookup.
 */
export function useClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  const fetchClientes = useCallback(async (search?: string) => {
    try {
      setLoading(true);
      const q = search ?? busca;
      const params = q ? `?busca=${encodeURIComponent(q)}` : "";
      const res = await fetch(`/api/clientes${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setClientes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
    } finally {
      setLoading(false);
    }
  }, [busca]);

  // Initial load + debounced search (300ms, cobre ambos os casos)
  useEffect(() => {
    const timeout = setTimeout(() => fetchClientes(), busca ? 300 : 0);
    return () => clearTimeout(timeout);
  }, [busca, fetchClientes]);

  const crud = useCrud<ClienteForm>({
    baseUrl: "/api/clientes",
    onSuccess: () => fetchClientes(),
    emptyForm,
  });

  const handleEdit = useCallback((cliente: Cliente) => {
    crud.openEdit(cliente.id, {
      nome: cliente.nome,
      telefone: cliente.telefone,
      cep: cliente.cep || "",
      rua: cliente.rua,
      numero: cliente.numero,
      bairro: cliente.bairro,
      cidade: cliente.cidade,
      enderecoAlternativo: cliente.enderecoAlternativo || "",
      observacoes: cliente.observacoes,
    });
  }, [crud.openEdit]);

  const saveInlineEdit = useCallback(async (id: number, field: string, value: string) => {
    try {
      await fetch(`/api/clientes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      fetchClientes();
    } catch (error) {
      console.error("Erro ao salvar:", error);
    }
  }, [fetchClientes]);

  const handleDelete = useCallback(async (id: number) => {
    return crud.remove(id, "Tem certeza que deseja excluir este cliente?");
  }, [crud.remove]);

  return {
    clientes,
    loading,
    busca,
    setBusca,
    fetchClientes,
    ...crud,
    handleEdit,
    saveInlineEdit,
    handleDelete,
  };
}

export { type ClienteForm };
