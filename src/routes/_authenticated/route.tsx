import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/lib/sessao";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Layout,
});

function Layout() {
  const { data: sessao } = useSessao();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function sair() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const link = "rounded-md px-3 py-1.5 text-sm text-primary-foreground/80 hover:bg-primary-foreground/10";
  const ativo = { className: "rounded-md px-3 py-1.5 text-sm bg-primary-foreground/15 text-primary-foreground" };

  return (
    <div className="min-h-screen bg-muted">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3">
          <Link to="/vendas" className="mr-4 font-bold">Lord Corretora</Link>
          <Link to="/vendas" className={link} activeProps={ativo} activeOptions={{ exact: true }}>Vendas</Link>
          <Link to="/vendas/novo" className={link} activeProps={ativo}>Nova Venda</Link>
          {sessao?.isAdmin && <Link to="/consultores" className={link} activeProps={ativo}>Consultores</Link>}
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-primary-foreground/80">
              {sessao?.nome} {sessao?.isAdmin && <span className="ml-1 rounded bg-accent px-1.5 py-0.5 text-xs text-accent-foreground">ADM</span>}
            </span>
            <Button size="sm" variant="secondary" onClick={sair}>Sair</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
