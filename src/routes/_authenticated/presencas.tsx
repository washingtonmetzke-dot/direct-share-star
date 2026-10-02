import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/lib/sessao";
import { useReuniao } from "@/lib/reuniao";
import { formatTelefone } from "@/lib/mask";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/presencas")({
  head: () => ({ meta: [{ title: "Presenças · Lord Corretora" }, { name: "description", content: "Confirmações de presença" }] }),
  component: Presencas,
});

type Confirmacao = { id: string; nome: string; telefone: string; criado_em: string };
type FormReuniao = { titulo: string; descricao: string; data: string; hora: string; local: string };

function Presencas() {
  const { data: sessao } = useSessao();
  const qc = useQueryClient();
  const { data: reuniao } = useReuniao();
  const [form, setForm] = useState<FormReuniao>({ titulo: "", descricao: "", data: "", hora: "", local: "" });
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (reuniao) {
      setForm({
        titulo: reuniao.titulo,
        descricao: reuniao.descricao,
        data: reuniao.data ?? "",
        hora: reuniao.hora,
        local: reuniao.local,
      });
    }
  }, [reuniao]);

  const { data: lista = [] } = useQuery({
    queryKey: ["presencas"],
    enabled: !!sessao?.isAdmin,
    queryFn: async (): Promise<Confirmacao[]> =>
      (await supabase.from("confirmacoes_presenca").select("id,nome,telefone,criado_em").order("criado_em", { ascending: false })).data ?? [],
  });

  if (sessao && !sessao.isAdmin) return <p>Acesso não autorizado.</p>;

  async function salvarReuniao(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const { error } = await supabase
      .from("reuniao")
      .update({
        titulo: form.titulo.trim() || "Reunião",
        descricao: form.descricao.trim(),
        data: form.data || null,
        hora: form.hora.trim(),
        local: form.local.trim(),
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", 1);
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Reunião atualizada com sucesso.");
    qc.invalidateQueries({ queryKey: ["reuniao"] });
  }

  async function remover(c: Confirmacao) {
    if (!confirm(`Remover a confirmação de ${c.nome}?`)) return;
    const { error } = await supabase.from("confirmacoes_presenca").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Confirmação removida.");
    qc.invalidateQueries({ queryKey: ["presencas"] });
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Presenças</h1>

      <form onSubmit={salvarReuniao} className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Dados da reunião (aparecem na tela inicial)</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5"><Label>Título</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} maxLength={150} /></div>
          <div className="space-y-1.5"><Label>Local</Label><Input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} maxLength={200} /></div>
          <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Horário</Label><Input type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5"><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} maxLength={1000} /></div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Link para divulgar: {typeof window !== "undefined" ? window.location.origin : ""}</p>
          <Button type="submit" size="sm" disabled={salvando}>{salvando ? "Salvando..." : "Salvar reunião"}</Button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <div className="border-b p-3 text-sm font-semibold">Confirmados ({lista.length})</div>
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left">
            <tr><th className="p-3">Nome</th><th className="p-3">Telefone</th><th className="p-3">Confirmou em</th><th className="p-3 text-right">Ações</th></tr>
          </thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3">{c.nome}</td>
                <td className="p-3">{formatTelefone(c.telefone)}</td>
                <td className="p-3">{new Date(c.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
                <td className="p-3 text-right"><Button size="sm" variant="destructive" onClick={() => remover(c)}>Remover</Button></td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhuma confirmação ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
