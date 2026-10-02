import { createFileRoute, Link } from "@tanstack/react-router";
import { useReuniao, dataBR } from "@/lib/reuniao";
import { Button } from "@/components/ui/button";
import lordLogo from "@/assets/lord-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lord Corretora" },
      { name: "description", content: "Confirme sua presença na reunião da Lord Corretora." },
      { property: "og:title", content: "Lord Corretora" },
      { property: "og:description", content: "Confirme sua presença na reunião da Lord Corretora." },
    ],
  }),
  component: Home,
});

function Home() {
  const { data: r } = useReuniao();
  const quando = [dataBR(r?.data), r?.hora].filter(Boolean).join(" às ");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#E2E9F0] px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <img src={lordLogo} alt="Lord Corretora de Seguros e Saúde" className="mx-auto w-56 rounded-lg shadow-sm" />

        {r?.ativa && (
          <div className="space-y-3 rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">{r.titulo || "Reunião"}</h2>
            {r.descricao && <p className="text-sm text-muted-foreground">{r.descricao}</p>}
            {(quando || r.local) && (
              <ul className="space-y-1 text-sm">
                {quando && <li><span className="font-medium">Quando:</span> {quando}</li>}
                {r.local && <li><span className="font-medium">Local:</span> {r.local}</li>}
              </ul>
            )}
            <Button asChild className="w-full"><Link to="/presenca">Confirmar presença</Link></Button>
          </div>
        )}

        <div className="space-y-3 rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Entrar no sistema</h2>
          <p className="text-sm text-muted-foreground">Acesso para consultores da corretora.</p>
          <Button asChild variant="outline" className="w-full"><Link to="/auth">Entrar</Link></Button>
        </div>
      </div>
    </div>
  );
}
