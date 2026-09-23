import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseDecimal, parseIntOrNull, TIPO_LABEL } from "@/lib/sessao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Tipo = "auto" | "saude" | "odonto";
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function VendaForm({ tipo, venda }: { tipo: Tipo; venda?: Record<string, any> }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [v, setV] = useState<Record<string, string>>(() => {
    const campos = ["nome","email","telefone","cidade","produto_auto","valor_apolice","forma_pagamento","numero_parcelas","seguradora","plano","operadora","administradora","nome_produtor","valor","numero_vidas","valor_total_fatura","vigencia","vencimento"];
    const o: Record<string, string> = {};
    campos.forEach((c) => (o[c] = str(venda?.[c])));
    if (!o.numero_parcelas) o.numero_parcelas = "1";
    return o;
  });
  const [salvando, setSalvando] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((p) => ({ ...p, [k]: e.target.value }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!v.nome.trim()) return toast.error("O campo Nome é obrigatório.");
    const comum = { nome: v.nome.trim(), email: v.email.trim(), telefone: v.telefone.trim(), cidade: v.cidade.trim() };
    let payload: Record<string, any>;
    if (tipo === "auto") {
      if (!v.produto_auto) return toast.error("Selecione um produto Auto válido.");
      if (!v.forma_pagamento) return toast.error("Selecione uma forma de pagamento válida.");
      payload = { ...comum, produto_auto: v.produto_auto, valor_apolice: parseDecimal(v.valor_apolice), forma_pagamento: v.forma_pagamento, numero_parcelas: parseIntOrNull(v.numero_parcelas) ?? 1, seguradora: v.seguradora.trim() };
    } else {
      payload = { ...comum, plano: v.plano.trim(), operadora: v.operadora.trim(), administradora: v.administradora.trim(), nome_produtor: v.nome_produtor.trim(), valor: parseDecimal(v.valor), numero_vidas: parseIntOrNull(v.numero_vidas), valor_total_fatura: parseDecimal(v.valor_total_fatura), vigencia: v.vigencia || null, vencimento: v.vencimento || null };
    }
    setSalvando(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = venda
      ? await supabase.from("vendas").update(payload).eq("id", venda.id)
      : await supabase.from("vendas").insert({ ...payload, tipo_produto: tipo, consultor_id: u.user!.id } as any);
    setSalvando(false);
    if (error) return toast.error("Erro ao salvar: " + error.message);
    toast.success(venda ? "Venda atualizada com sucesso." : "Venda cadastrada com sucesso.");
    qc.invalidateQueries({ queryKey: ["vendas"] });
    navigate({ to: "/vendas" });
  }

  const F = ({ id, label, type = "text", ...rest }: { id: string; label: string; type?: string; [k: string]: any }) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={v[id]} onChange={set(id)} {...rest} />
    </div>
  );
  const sel = "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <form onSubmit={salvar} className="space-y-6 rounded-xl border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold">{venda ? "Editar" : "Nova"} venda · {TIPO_LABEL[tipo]}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {F({ id: "nome", label: "Nome *", required: true })}
        {F({ id: "email", label: "E-mail", type: "email" })}
        {F({ id: "telefone", label: "Telefone" })}
        {F({ id: "cidade", label: "Cidade" })}
      </div>
      <hr />
      {tipo === "auto" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="produto_auto">Produto *</Label>
            <select id="produto_auto" className={sel} value={v.produto_auto} onChange={set("produto_auto")}>
              <option value="">Selecione...</option>
              <option value="carro">Carro</option><option value="moto">Moto</option>
              <option value="caminhao">Caminhão</option><option value="bike">Bike</option><option value="frota">Frota</option>
            </select>
          </div>
          {F({ id: "seguradora", label: "Seguradora" })}
          {F({ id: "valor_apolice", label: "Valor da apólice (R$)", inputMode: "decimal", placeholder: "0,00" })}
          <div className="space-y-1.5">
            <Label htmlFor="forma_pagamento">Forma de pagamento *</Label>
            <select id="forma_pagamento" className={sel} value={v.forma_pagamento} onChange={set("forma_pagamento")}>
              <option value="">Selecione...</option>
              <option value="cartao">Cartão</option><option value="carne">Carnê</option><option value="pix">Pix</option>
            </select>
          </div>
          {F({ id: "numero_parcelas", label: "Nº de parcelas", type: "number", min: 1, max: 24 })}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {F({ id: "plano", label: "Plano" })}
          {F({ id: "operadora", label: "Operadora" })}
          {F({ id: "administradora", label: "Administradora" })}
          {F({ id: "nome_produtor", label: "Nome do produtor" })}
          {F({ id: "valor", label: "Valor (R$)", inputMode: "decimal", placeholder: "0,00" })}
          {F({ id: "numero_vidas", label: "Nº de vidas", type: "number", min: 0 })}
          {F({ id: "valor_total_fatura", label: "Valor total da fatura (R$)", inputMode: "decimal", placeholder: "0,00" })}
          {F({ id: "vigencia", label: "Vigência", type: "date" })}
          {F({ id: "vencimento", label: "Vencimento", type: "date" })}
        </div>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</Button>
        <Button type="button" variant="outline" onClick={() => navigate({ to: "/vendas" })}>Cancelar</Button>
      </div>
    </form>
  );
}
