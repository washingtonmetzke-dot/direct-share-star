import { createFileRoute, Link, Outlet, redirect, useNavigate, type LinkProps } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, ClipboardList, Layers, LogOut, Menu, PlusCircle, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/lib/sessao";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  pendingComponent: () => <div className="min-h-screen bg-muted" />,
  pendingMs: 0,
  pendingMinMs: 0,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: c } = await supabase.from("consultores").select("ativo").eq("id", data.user.id).maybeSingle();
    if (!c?.ativo) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: Layout,
});

const itemBase = "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors";
const itemInativo = `${itemBase} text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground`;
const itemAtivo = { className: `${itemBase} bg-accent text-accent-foreground` };

function Item({ to, icon, exact, onClick, children }: { to: LinkProps["to"]; icon: ReactNode; exact?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Link to={to} className={itemInativo} activeProps={itemAtivo} activeOptions={{ exact }} onClick={onClick}>
      {icon}
      {children}
    </Link>
  );
}

function Layout() {
  const { data: sessao } = useSessao();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);

  async function sair() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const fechar = () => setAberto(false);
  const icone = "h-[18px] w-[18px] shrink-0";

  return (
    <div className="min-h-screen bg-muted">
      <div className="sticky top-0 z-30 flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground md:hidden">
        <button type="button" aria-label="Abrir menu" onClick={() => setAberto(true)}>
          <Menu className="h-6 w-6" />
        </button>
        <span className="font-bold">Lord Corretora</span>
      </div>

      {aberto && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={fechar} />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-primary text-primary-foreground transition-transform md:translate-x-0 ${
          aberto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-primary-foreground/10 px-4 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-lg font-bold text-accent-foreground">L</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">Lord Corretora</div>
            <div className="flex items-center gap-1.5 text-xs text-primary-foreground/70">
              <span className="truncate">{sessao?.nome}</span>
              {sessao?.isAdmin && <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">ADM</span>}
            </div>
          </div>
          <button type="button" aria-label="Fechar menu" className="md:hidden" onClick={fechar}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-primary-foreground/50">Menu</div>
          <Item to="/vendas" exact icon={<ClipboardList className={icone} />} onClick={fechar}>Vendas</Item>
          <Item to="/vendas/novo" icon={<PlusCircle className={icone} />} onClick={fechar}>Nova Venda</Item>
          {sessao?.isAdmin && <Item to="/consultores" icon={<Users className={icone} />} onClick={fechar}>Consultores</Item>}
          {sessao?.isAdmin && <Item to="/grupos" icon={<Layers className={icone} />} onClick={fechar}>Grupos</Item>}
          {sessao?.isAdmin && <Item to="/presencas" icon={<CalendarCheck className={icone} />} onClick={fechar}>Presenças</Item>}
          <button type="button" className={`${itemInativo} w-full`} onClick={sair}>
            <LogOut className={icone} />
            Sair
          </button>
        </nav>
      </aside>

      <main className="px-4 py-6 md:pl-72 md:pr-8">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
