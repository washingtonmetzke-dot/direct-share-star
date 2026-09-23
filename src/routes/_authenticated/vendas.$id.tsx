import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/lib/sessao";
import { VendaForm } from "@/components/VendaForm";

export const Route = createFileRoute("/_authenticated/vendas/$id")({
  head: () => ({ meta: [{ title: "Editar Venda · Zagal Corretora" }, { name: "description", content: "Editar venda" }] }),
  component: Editar,
});

function Editar() {
  const { id } = Route.useParams();
  const { data: sessao } = useSessao();
  const { data: venda, isLoading } = useQuery({
    queryKey: ["venda", id],
    queryFn: async () => (await supabase.from("vendas").select("*").eq("id", id).maybeSingle()).data,
  });
  if (sessao && !sessao.isAdmin) return <p>Acesso não autorizado.</p>;
  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!venda) return <p>Venda não encontrada.</p>;
  return <VendaForm tipo={venda.tipo_produto as any} venda={venda} />;
}
