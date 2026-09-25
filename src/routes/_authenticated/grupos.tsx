import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/lib/sessao";
import { criarGrupo, editarGrupo, excluirGrupo } from "@/lib/grupos.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/grupos")({
  head: () => ({ meta: [{ title: "Grupos · Lord Corretora" }, { name: "description", content: "Gestão de grupos" }] }),
  component: Grupos,
});

type Linha = { id: string; nome: string };
type Form = { id?: string; nome: string };

function mensagem(err: any) {
  const m = err?.message ?? String(err);
  try {
    const p = JSON.parse(m);
    if (Array.isArray(p)) return p[0]?.message ?? m;
  } catch {}
  return m;
}

function Grupos() {
  const { data: sessao } = useSessao();
  const qc = useQueryClient();
  const criar = useServerFn(criarGrupo);
  const editar = useServerFn(editarGrupo);
  const excluir = useServerFn(excluirGrupo);
  const [form, setForm] = useState<Form | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { data: lista = [] } = useQuery({
    queryKey: ["grupos-full"],
    enabled: !!sessao?.isAdmin,
    queryFn: async (): Promise<Linha[]> => (await supabase.from("grupos").select("id,nome").order("nome")).data ?? [],
  });

  if (sessao && !sessao.isAdmin) return <p>Acesso não autorizado.</p>;

  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ["grupos-full"] });
    qc.invalidateQueries({ queryKey: ["grupos"] });
    qc.invalidateQueries({ queryKey: ["grupos-nomes"] });
  };

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSalvando(true);
    try {
      if (form.id) {
        await editar({ data: { id: form.id, nome: form.nome } });
        toast.success("Grupo atualizado com sucesso.");
      } else {
        await criar({ data: { nome: form.nome } });
        toast.success("Grupo cadastrado com sucesso.");
      }
      setForm(null);
      atualizar();
    } catch (err: any) {
      toast.error(mensagem(err));
    } finally {
      setSalvando(false);
    }
  }

  async function remover(g: Linha) {
    if (!confirm(`Excluir o grupo ${g.nome}?`)) return;
    try {
      await excluir({ data: { id: g.id } });
      toast.success("Grupo excluído com sucesso.");
      atualizar();
    } catch (err: any) {
      toast.error(mensagem(err));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Grupos</h1>
        <Button size="sm" onClick={() => setForm({ nome: "" })}>+ Novo Grupo</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left">
            <tr><th className="p-3">Nome</th><th className="p-3 text-right">Ações</th></tr>
          </thead>
          <tbody>
            {lista.map((g) => (
              <tr key={g.id} className="border-t">
                <td className="p-3">{g.nome}</td>
                <td className="space-x-2 whitespace-nowrap p-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => setForm({ id: g.id, nome: g.nome })}>Editar</Button>
                  <Button size="sm" variant="destructive" onClick={() => remover(g)}>Excluir</Button>
                </td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={2} className="p-6 text-center text-muted-foreground">Nenhum grupo cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Editar grupo" : "Novo grupo"}</DialogTitle></DialogHeader>
          {form && (
            <form onSubmit={salvar} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome do grupo *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
                <Button type="submit" disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
