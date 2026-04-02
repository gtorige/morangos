import { useCallback, useState } from "react";

interface UseCrudOptions<TForm> {
  /** Base API URL, e.g. "/api/clientes" */
  baseUrl: string;
  /** Callback after any successful mutation (create/update/delete) */
  onSuccess: () => void;
  /** Empty form for resetting */
  emptyForm: TForm;
}

/**
 * Hook for standard CRUD operations (create, update, delete).
 * Manages form state, editing mode, dialog open state, and saving state.
 */
export function useCrud<TForm extends Record<string, unknown>>(options: UseCrudOptions<TForm>) {
  const { baseUrl, onSuccess, emptyForm } = options;

  const [form, setForm] = useState<TForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openNew = useCallback(() => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }, [emptyForm]);

  const openEdit = useCallback((id: number, data: TForm) => {
    setEditingId(id);
    setForm(data);
    setDialogOpen(true);
  }, []);

  const close = useCallback(() => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }, [emptyForm]);

  const submit = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const url = editingId ? `${baseUrl}/${editingId}` : baseUrl;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err.error || `Erro ${res.status}`;
        setError(msg);
        throw new Error(msg);
      }
      close();
      onSuccess();
      return await res.json();
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Erro ao salvar`;
      setError(msg);
      console.error(`Erro ao salvar em ${baseUrl}:`, err);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [baseUrl, editingId, form, close, onSuccess]);

  const remove = useCallback(async (id: number, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return false;
    try {
      const res = await fetch(`${baseUrl}/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erro ${res.status}`);
      }
      onSuccess();
      return true;
    } catch (error) {
      console.error(`Erro ao excluir em ${baseUrl}:`, error);
      return false;
    }
  }, [baseUrl, onSuccess]);

  return {
    form,
    setForm,
    editingId,
    dialogOpen,
    setDialogOpen,
    saving,
    error,
    setError,
    openNew,
    openEdit,
    close,
    submit,
    remove,
  };
}
