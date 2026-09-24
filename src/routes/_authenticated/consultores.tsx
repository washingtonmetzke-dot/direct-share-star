import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/lib/sessao";
import { criarConsultor, editarConsultor, excluirConsultor, verificarSenhaMaster } from "@/lib/consultores.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/consultores")({
  head: () => ({ meta: [{ title: "Consultores · Lord Corretora" }, { name: "description", content: "Gestão de consultores" }] }),
  component: Consultores,
});

type Linha = { id: string; nome: string; observacao: string | null; ativo: boolean; is_admin: boolean; is_master: boolean };
type Form = {
  id?: string;
  nome: string;
  senha: string;
  is_admin: boolean;
  ativo: boolean;
  observacao: string;
  is_master: boolean;
  senha_master_atual: string;
};

function Consultores() {
  const { data: sessao } = useSessao();
  const qc = useQueryClient();
  const criar = useServerFn(criarConsultor);
  const editar = useServerFn(editarConsultor);
  const excluir = useServerFn(excluirConsultor);
  const verificarSenha = useServerFn(verificarSenhaMaster);
  const [form, setForm] = useState<Form | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmarDesmarcar, setConfirmarDesmarcar] = useState(false);
  const [senhaDesmarcar, setSenhaDesmarcar] = useState("");
  const [verificandoSenha, setVerificandoSenha] = useState(false);

  const { data: lista = [] } = useQuery({
    queryKey: ["consultores-full"],
    enabled: !!sessao?.isAdmin,
    queryFn: async (): Promise<Linha[]> => {
      const [{ data: cs }, { data: rs }] = await Promise.all([
        supabase.from("consultores").select("*").order("nome"),
        supabase.from("user_roles").select("user_id").eq("role", "admin"),
      ]);
      const admins = new Set((rs ?? []).map((r) => r.user_id));
      return (cs ?? []).map((c) => ({ ...c, is_admin: admins.has(c.id) }));
    },
  });

  if (sessao && !sessao.isAdmin) return <p>Acesso não autorizado.</p>;

  const totalAdminsAtivos = lista.filter((c) => c.is_admin && c.ativo).length;

  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ["consultores-full"] });
    qc.invalidateQueries({ queryKey: ["consultores"] });
    qc.invalidateQueries({ queryKey: ["sessao"] });
  };

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSalvando(true);
    try {
      if (form.id) {
        await editar({
          data: {
            id: form.id,
            nome: form.nome,
            senha: form.senha,
            is_admin: form.is_admin,
            ativo: form.ativo,
            observacao: form.observacao,
            is_master: form.is_master,
            senha_master_atual: form.senha_master_atual,
          },
        });
        toast.success("Consultor atualizado com sucesso.");
      } else {
        await criar({ data: { nome: form.nome, senha: form.senha, is_admin: form.is_admin, observacao: form.observacao } });
        toast.success("Consultor cadastrado com sucesso.");
      }
      setForm(null);
      atualizar();
    } catch (err: any) {
      toast.error(mensagem(err));
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarDesmarcarMaster() {
    if (!senhaDesmarcar) { toast.error("Digite a senha atual do usuário master."); return; }
    setVerificandoSenha(true);
    try {
      const { ok } = await verificarSenha({ data: { senha: senhaDesmarcar } });
      if (!ok) { toast.error("Senha incorreta."); return; }
      setForm((f) => (f ? { ...f, is_master: false, senha_master_atual: "" } : f));
      setConfirmarDesmarcar(false);
      setSenhaDesmarcar("");
    } catch (err: any) {
      toast.error(mensagem(err));
    } finally {
      setVerificandoSenha(false);
    }
  }

  async function remover(c: Linha) {
    if (!confirm(`Excluir o consultor ${c.nome}?`)) return;
    try {
      await excluir({ data: { id: c.id } });
      toast.success("Consultor excluído com sucesso.");
      atualizar();
    } catch (err: any) {
      toast.error(mensagem(err));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Consultores</h1>
        <Button size="sm" onClick={() => setForm({ nome: "", senha: "", is_admin: false, ativo: true, observacao: "", is_master: false, senha_master_atual: "" })}>+ Novo Consultor</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left">
            <tr><th className="p-3">Nome</th><th className="p-3">Perfil</th><th className="p-3">Status</th><th className="p-3">Observação</th><th className="p-3 text-right">Ações</th></tr>
          </thead>
          <tbody>
            {lista.map((c) => {
              const ultimoAdmin = c.is_admin && c.ativo && totalAdminsAtivos <= 1;
              return (
                <tr key={c.id} className="border-t">
                  <td className="p-3">{c.nome}</td>
                  <td className="p-3">{c.is_admin ? "ADM" : "Consultor"}</td>
                  <td className="p-3">{c.ativo ? <span className="text-primary">Ativo</span> : <span className="text-muted-foreground">Inativo</span>}</td>
                  <td className="max-w-xs truncate p-3 text-muted-foreground">{c.observacao || "—"}</td>
                  <td className="space-x-2 whitespace-nowrap p-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setForm({
                          id: c.id,
                          nome: c.nome,
                          senha: "",
                          is_admin: c.is_admin,
                          ativo: c.ativo,
                          observacao: c.observacao ?? "",
                          is_master: c.is_master,
                          senha_master_atual: "",
                        })
                      }
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={ultimoAdmin || c.is_master}
                      title={
                        c.is_master
                          ? "Não é possível excluir: este é o usuário master do sistema."
                          : ultimoAdmin
                            ? "Não é possível excluir: este é o único ADM ativo do sistema."
                            : undefined
                      }
                      onClick={() => remover(c)}
                    >
                      Excluir
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Editar consultor" : "Novo consultor"}</DialogTitle></DialogHeader>
          {form && (
            <form onSubmit={salvar} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
                <p className="text-xs text-muted-foreground">O consultor faz login com este nome.</p>
              </div>
              {form.id && form.is_master ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Senha atual do usuário master *</Label>
                    <Input
                      type="password"
                      value={form.senha_master_atual}
                      onChange={(e) => setForm({ ...form, senha_master_atual: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Só é possível trocar a senha do master confirmando a senha atual dele.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nova senha (deixe em branco para manter)</Label>
                    <Input
                      type="password"
                      value={form.senha}
                      onChange={(e) => setForm({ ...form, senha: e.target.value })}
                      disabled={!form.senha_master_atual}
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <Label>{form.id ? "Nova senha (deixe em branco para manter)" : "Senha *"}</Label>
                  <Input type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} required={!form.id} />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.is_admin} onCheckedChange={(v) => setForm({ ...form, is_admin: !!v })} /> Administrador (ADM)</label>
              {form.id && <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: !!v })} /> Ativo</label>}
              {form.id && !lista.some((x) => x.is_master && x.id !== form.id) && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.is_master}
                    onCheckedChange={(v) => {
                      if (form.is_master && !v) {
                        setSenhaDesmarcar("");
                        setConfirmarDesmarcar(true);
                        return;
                      }
                      if (!form.is_master && v) {
                        const outro = lista.find((x) => x.is_master && x.id !== form.id);
                        if (outro) {
                          toast.error(`Já existe um usuário master (${outro.nome}). Desmarque-o antes de definir outro.`);
                          return;
                        }
                      }
                      setForm({ ...form, is_master: !!v, senha_master_atual: "" });
                    }}
                  />
                  Usuário master
                </label>
              )}
              <div className="space-y-1.5"><Label>Observação</Label><Textarea value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} /></div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
                <Button type="submit" disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmarDesmarcar} onOpenChange={(o) => { if (!o) { setConfirmarDesmarcar(false); setSenhaDesmarcar(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar senha do usuário master</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Para desmarcar "Usuário master", digite a senha atual dele.
          </p>
          <div className="space-y-1.5">
            <Label>Senha atual do usuário master</Label>
            <Input
              type="password"
              value={senhaDesmarcar}
              onChange={(e) => setSenhaDesmarcar(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmarDesmarcarMaster(); } }}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => { setConfirmarDesmarcar(false); setSenhaDesmarcar(""); }}>Cancelar</Button>
            <Button type="button" disabled={verificandoSenha} onClick={confirmarDesmarcarMaster}>
              {verificandoSenha ? "Verificando..." : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function mensagem(err: any) {
  const m = err?.message ?? String(err);
  try {
    const p = JSON.parse(m);
    if (Array.isArray(p)) return p[0]?.message ?? m;
  } catch {}
  return m;
}
