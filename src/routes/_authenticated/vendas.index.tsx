import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSessao, TIPO_LABEL } from "@/lib/sessao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/vendas/")({
  head: () => ({ meta: [{ title: "Vendas · Zagal Corretora" }, { name: "description", content: "Vendas cadastradas" }] }),
  component: Vendas,
});

const badge: Record<string, string> = { auto: "bg-primary text-primary-foreground", saude: "bg-accent text-accent-foreground", odonto: "bg-secondary text-secondary-foreground" };

function Vendas() {
  const { data: sessao } = useSessao();
  const isAdmin = !!sessao?.isAdmin;
  const qc = useQueryClient();
  const [tipo, setTipo] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [consultor, setConsultor] = useState("");

  const { data: vendas = [] } = useQuery({
    queryKey: ["vendas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendas").select("*").order("data_cadastro", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: consultores = [] } = useQuery({
    queryKey: ["consultores"],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from("consultores").select("id,nome").order("nome")).data ?? [],
  });
  const nomeDe = useMemo(() => Object.fromEntries(consultores.map((c) => [c.id, c.nome])), [consultores]);

  const semConsultor = vendas.filter((v) => {
    const d = v.data_cadastro.slice(0, 10);
    return (!tipo || v.tipo_produto === tipo) && (!de || d >= de) && (!ate || d <= ate);
  });
  const filtradas = semConsultor.filter((v) => !consultor || v.consultor_id === consultor);

  const ranking = useMemo(() => {
    const m: Record<string, number> = {};
    semConsultor.forEach((v) => (m[v.consultor_id] = (m[v.consultor_id] ?? 0) + 1));
    return Object.entries(m).map(([id, n]) => ({ nome: nomeDe[id] ?? "—", vendas: n })).sort((a, b) => b.vendas - a.vendas);
  }, [semConsultor, nomeDe]);

  async function excluir(id: string, nome: string) {
    if (!confirm(`Excluir a venda de ${nome}?`)) return;
    const { error } = await supabase.from("vendas").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Venda excluída com sucesso.");
    qc.invalidateQueries({ queryKey: ["vendas"] });
  }

  const sel = "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Vendas Cadastradas</h1>
        <Button asChild size="sm"><Link to="/vendas/novo">+ Nova Venda</Link></Button>
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm md:grid-cols-4">
        <div className="space-y-1.5"><Label>Produto</Label>
          <select className={sel} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option><option value="auto">Auto</option><option value="saude">Saúde</option><option value="odonto">Odonto</option>
          </select></div>
        <div className="space-y-1.5"><Label>De</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
        {isAdmin && (
          <div className="space-y-1.5"><Label>Consultor</Label>
            <select className={sel} value={consultor} onChange={(e) => setConsultor(e.target.value)}>
              <option value="">Todos</option>
              {consultores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select></div>
        )}
      </div>

      {isAdmin && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Ranking de vendas por consultor</h2>
          {ranking.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ranking}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="nome" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Bar dataKey="vendas" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground">Nenhuma venda encontrada para o período/filtro selecionado.</p>}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left">
            <tr>
              <th className="p-3">Nome</th><th className="p-3">Tipo</th><th className="p-3">Seguradora / Operadora</th>
              <th className="p-3">Vidas</th><th className="p-3">Cidade</th>
              {isAdmin && <th className="p-3">Consultor</th>}
              <th className="p-3">Data</th>
              {isAdmin && <th className="p-3 text-right">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {filtradas.map((v) => (
              <tr key={v.id} className="border-t hover:bg-muted/40">
                <td className="p-3">{v.nome}</td>
                <td className="p-3"><span className={`rounded px-2 py-0.5 text-xs ${badge[v.tipo_produto]}`}>{TIPO_LABEL[v.tipo_produto]}</span></td>
                <td className="p-3">{(v.tipo_produto === "auto" ? v.seguradora : v.operadora) || "—"}</td>
                <td className="p-3">{v.tipo_produto !== "auto" && v.numero_vidas != null ? v.numero_vidas : "—"}</td>
                <td className="p-3">{v.cidade || "—"}</td>
                {isAdmin && <td className="p-3">{nomeDe[v.consultor_id] ?? "—"}</td>}
                <td className="p-3">{new Date(v.data_cadastro).toLocaleDateString("pt-BR")}</td>
                {isAdmin && (
                  <td className="space-x-2 whitespace-nowrap p-3 text-right">
                    <Button asChild size="sm" variant="outline"><Link to="/vendas/$id" params={{ id: v.id }}>Editar</Link></Button>
                    <Button size="sm" variant="destructive" onClick={() => excluir(v.id, v.nome)}>Excluir</Button>
                  </td>
                )}
              </tr>
            ))}
            {!filtradas.length && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhuma venda encontrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
