import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { VendaForm } from "@/components/VendaForm";

export const Route = createFileRoute("/_authenticated/vendas/novo")({
  head: () => ({ meta: [{ title: "Nova Venda · Zagal Corretora" }, { name: "description", content: "Cadastrar nova venda" }] }),
  component: Novo,
});

const opcoes = [
  { tipo: "auto", titulo: "Auto", desc: "Carro, moto, caminhão, bike e frota" },
  { tipo: "saude", titulo: "Saúde", desc: "Planos de saúde" },
  { tipo: "odonto", titulo: "Odonto", desc: "Planos odontológicos" },
] as const;

function Novo() {
  const [tipo, setTipo] = useState<"auto" | "saude" | "odonto" | null>(null);
  if (tipo) return <VendaForm key={tipo} tipo={tipo} />;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Qual produto foi vendido?</h1>
      <div className="grid gap-4 md:grid-cols-3">
        {opcoes.map((o) => (
          <button key={o.tipo} onClick={() => setTipo(o.tipo)} className="rounded-xl border bg-card p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md">
            <div className="text-xl font-semibold text-primary">{o.titulo}</div>
            <div className="mt-1 text-sm text-muted-foreground">{o.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
