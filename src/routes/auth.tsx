import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { garantirMaster, EMAIL_DOMAIN } from "@/lib/consultores.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import lordLogo from "@/assets/lord-logo.png";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar · Lord Corretora" },
      { name: "description", content: "Acesso ao sistema de cadastro de vendas da Lord Corretora." },
      { property: "og:title", content: "Entrar · Lord Corretora" },
      { property: "og:description", content: "Acesso ao sistema de cadastro de vendas da Lord Corretora." },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [codigo, setCodigo] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    garantirMaster().catch(() => {});
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/vendas", replace: true });
    });
  }, [navigate]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    const email = `${codigo.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error || !data.user) {
      setCarregando(false);
      return setErro("Código ou senha inválidos.");
    }
    const { data: c } = await supabase.from("consultores").select("ativo").eq("id", data.user.id).maybeSingle();
    if (!c?.ativo) {
      await supabase.auth.signOut();
      setCarregando(false);
      return setErro("Código ou senha inválidos.");
    }
    qc.clear();
    navigate({ to: "/vendas", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <form onSubmit={entrar} className="w-full max-w-sm space-y-5 rounded-xl border bg-card p-8 shadow-sm">
        <div className="text-center">
          <img src={lordLogo} alt="Lord Corretora de Seguros e Saúde" className="mx-auto w-56 rounded-lg shadow-sm" />
          <p className="mt-3 text-sm text-muted-foreground">Cadastro de vendas</p>
        </div>
        {erro && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</div>}
        <div className="space-y-2">
          <Label htmlFor="codigo">Usuário</Label>
          <Input id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} required autoFocus />
        </div>
        <div className="space-y-2">
          <Label htmlFor="senha">Senha</Label>
          <Input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={carregando}>
          {carregando ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
