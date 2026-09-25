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
  head: () => ({ meta: [{ title: "Vendas · Lord Corretora" }, { name: "description", content: "Vendas cadastradas" }] }),
  component: Vendas,
});

const badge: Record<string, string> = { auto: "bg-primary text-primary-foreground", saude: "bg-accent text-accent-foreground", odonto: "bg-secondary text-secondary-foreground" };

// Data local (não UTC) no formato yyyy-mm-dd, para bater com os campos De/Até
// e com a data exibida na coluna Data (evita divergência perto da virada do dia).
function dataLocal(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function Vendas() {
  const { data: sessao } = useSessao();
  const isAdmin = !!sessao?.isAdmin;
  const isLider = !!sessao?.isLider;
  const podeVerMultiplos = isAdmin || isLider;
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
    queryKey: ["consultores", podeVerMultiplos],
    enabled: podeVerMultiplos,
    // Para ADM, a RLS libera todos; para líder, a RLS já restringe automaticamente
    // aos consultores do próprio grupo (mais ele mesmo).
    queryFn: async () => (await supabase.from("consultores").select("id,nome").eq("is_master", false).order("nome")).data ?? [],
  });
  const nomeDe = useMemo(() => Object.fromEntries(consultores.map((c) => [c.id, c.nome])), [consultores]);

  // Só para ADM: dados extras de todos os consultores/grupos, para montar o
  // comparativo de vendas por grupo (líder + seus membros).
  const { data: consultoresComGrupo = [] } = useQuery({
    queryKey: ["consultores-com-grupo"],
    enabled: isAdmin,
    queryFn: async () =>
      (await supabase.from("consultores").select("id,nome,is_lider,grupo_id").eq("is_master", false).order("nome")).data ?? [],
  });
  const { data: gruposList = [] } = useQuery({
    queryKey: ["grupos-nomes"],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from("grupos").select("id,nome").order("nome")).data ?? [],
  });

  const semConsultor = vendas.filter((v) => {
    const d = dataLocal(v.data_cadastro);
    return (!tipo || v.tipo_produto === tipo) && (!de || d >= de) && (!ate || d <= ate);
  });
  const filtradas = semConsultor.filter((v) => !consultor || v.consultor_id === consultor);

  const ranking = useMemo(() => {
    const m: Record<string, number> = {};
    semConsultor.forEach((v) => (m[v.consultor_id] = (m[v.consultor_id] ?? 0) + 1));
    return Object.entries(m).map(([id, n]) => ({ nome: nomeDe[id] ?? "—", vendas: n })).sort((a, b) => b.vendas - a.vendas);
  }, [semConsultor, nomeDe]);

  // Comparativo (ADM): venda geral de cada líder somada às do seu grupo.
  const rankingGrupos = useMemo(() => {
    if (!isAdmin) return [];
    const nomeGrupo = new Map(gruposList.map((g) => [g.id, g.nome]));
    const liderPorGrupo = new Map<string, string>();
    consultoresComGrupo.forEach((c) => {
      if (c.is_lider && c.grupo_id) liderPorGrupo.set(c.grupo_id, c.nome);
    });
    const grupoDoConsultor = new Map(consultoresComGrupo.map((c) => [c.id, c.grupo_id]));
    const contagem = new Map<string, number>();
    semConsultor.forEach((v) => {
      const gId = grupoDoConsultor.get(v.consultor_id);
      if (gId && liderPorGrupo.has(gId)) contagem.set(gId, (contagem.get(gId) ?? 0) + 1);
    });
    return Array.from(contagem.entries())
      .map(([gId, n]) => ({ nome: `${liderPorGrupo.get(gId)} · ${nomeGrupo.get(gId) ?? "—"}`, vendas: n }))
      .sort((a, b) => b.vendas - a.vendas);
  }, [isAdmin, gruposList, consultoresComGrupo, semConsultor]);

  const colCount = 6 + (podeVerMultiplos ? 1 : 0) + (isAdmin ? 1 : 0);

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
        {podeVerMultiplos && (
          <div className="space-y-1.5"><Label>Consultor</Label>
            <select className={sel} value={consultor} onChange={(e) => setConsultor(e.target.value)}>
              <option value="">Todos</option>
              {consultores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select></div>
        )}
      </div>

      {podeVerMultiplos && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">
            Ranking de vendas por consultor{isLider && !isAdmin ? " (seu grupo)" : ""}
          </h2>
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

      {isAdmin && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Comparativo de vendas por grupo (líderes)</h2>
          {rankingGrupos.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={rankingGrupos}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="nome" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Bar dataKey="vendas" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground">Nenhum grupo com líder definido ainda.</p>}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left">
            <tr>
              <th className="p-3">Nome</th><th className="p-3">Tipo</th><th className="p-3">Seguradora / Operadora</th>
              <th className="p-3">Vidas</th><th className="p-3">Cidade</th>
              {podeVerMultiplos && <th className="p-3">Consultor</th>}
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
                {podeVerMultiplos && <td className="p-3">{nomeDe[v.consultor_id] ?? "—"}</td>}
                <td className="p-3">{new Date(v.data_cadastro).toLocaleDateString("pt-BR")}</td>
                {isAdmin && (
                  <td className="space-x-2 whitespace-nowrap p-3 text-right">
                    <Button asChild size="sm" variant="outline"><Link to="/vendas/$id" params={{ id: v.id }}>Editar</Link></Button>
                    <Button size="sm" variant="destructive" onClick={() => excluir(v.id, v.nome)}>Excluir</Button>
                  </td>
                )}
              </tr>
            ))}
            {!filtradas.length && <tr><td colSpan={colCount} className="p-6 text-center text-muted-foreground">Nenhuma venda encontrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
