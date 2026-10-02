import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useReuniao, dataBR } from "@/lib/reuniao";
import { formatTelefone } from "@/lib/mask";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import lordLogo from "@/assets/lord-logo.png";

export const Route = createFileRoute("/presenca")({
  head: () => ({
    meta: [
      { title: "Confirmar presença · Lord Corretora" },
      { name: "description", content: "Confirme sua presença na reunião da Lord Corretora." },
      { property: "og:title", content: "Confirmar presença · Lord Corretora" },
      { property: "og:description", content: "Confirme sua presença na reunião da Lord Corretora." },
    ],
  }),
  component: Presenca,
});

function Presenca() {
  const { data: r, isLoading } = useReuniao();
  const encerrada = !isLoading && !r?.ativa;
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const quando = [dataBR(r?.data), r?.hora].filter(Boolean).join(" às ");

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const nomeLimpo = nome.trim();
    const digitos = telefone.replace(/\D/g, "");
    if (nomeLimpo.length < 2) return setErro("Informe seu nome.");
    if (digitos.length < 10 || digitos.length > 11) return setErro("Informe um telefone válido com DDD.");
    setEnviando(true);
    const { error } = await supabase.from("confirmacoes_presenca").insert({ nome: nomeLimpo, telefone: digitos });
    setEnviando(false);
    if (error) {
      if (error.code === "23505") return setErro("Esse telefone já confirmou presença.");
      if (error.code === "42501") return setErro("As confirmações de presença estão encerradas.");
      return setErro("Não foi possível confirmar agora. Tente novamente.");
    }
    setConfirmado(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#E2E9F0] px-4 py-10">
      <div className="w-full max-w-sm space-y-5 rounded-xl border bg-card p-8 shadow-sm">
        <div className="text-center">
          <img src={lordLogo} alt="Lord Corretora de Seguros e Saúde" className="mx-auto w-48 rounded-lg shadow-sm" />
          {!encerrada && (
            <>
              <h1 className="mt-3 text-lg font-semibold">{r?.titulo || "Reunião"}</h1>
              {quando && <p className="text-sm text-muted-foreground">{quando}</p>}
              {r?.local && <p className="text-sm text-muted-foreground">{r.local}</p>}
            </>
          )}
        </div>

        {encerrada ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">As confirmações de presença estão encerradas no momento.</p>
            <Button asChild variant="outline" className="w-full"><Link to="/">Voltar ao início</Link></Button>
          </div>
        ) : confirmado ? (
          <div className="space-y-4 text-center">
            <div className="rounded-md bg-primary/10 px-3 py-3 text-sm text-primary">Presença confirmada! Obrigado, {nome.trim()}.</div>
            <Button asChild variant="outline" className="w-full"><Link to="/">Voltar ao início</Link></Button>
          </div>
        ) : (
          <form onSubmit={confirmar} className="space-y-4">
            {erro && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</div>}
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                inputMode="tel"
                placeholder="(27) 99999-9999"
                maxLength={15}
                value={telefone}
                onChange={(e) => setTelefone(formatTelefone(e.target.value))}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={enviando}>{enviando ? "Confirmando..." : "Confirmar presença"}</Button>
            <Button asChild type="button" variant="ghost" className="w-full"><Link to="/">Voltar</Link></Button>
          </form>
        )}
      </div>
    </div>
  );
}
