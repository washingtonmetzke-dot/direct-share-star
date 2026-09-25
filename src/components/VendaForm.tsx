import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { parseDecimal, parseIntOrNull, TIPO_LABEL } from "@/lib/sessao";
import { formatTelefone, formatMoeda, numeroParaMoeda } from "@/lib/mask";
import { CIDADES_ES } from "@/lib/cidades-es";
import { SEGURADORAS } from "@/lib/seguradoras";
import { criarVenda, editarVenda } from "@/lib/vendas.functions";
import {
  ADMINISTRADORAS_SAUDE,
  OPERADORAS_SAUDE,
  ADMINISTRADORAS_ODONTO,
  OPERADORAS_ODONTO,
  VENCIMENTOS,
} from "@/lib/planos-saude-odonto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

function mensagem(err: any) {
  const m = err?.message ?? String(err);
  try {
    const p = JSON.parse(m);
    if (Array.isArray(p)) return p[0]?.message ?? m;
  } catch {}
  return m;
}

type Tipo = "auto" | "saude" | "odonto";
const CAMPOS = ["nome","email","telefone","cidade","produto_auto","valor_apolice","forma_pagamento","numero_parcelas","seguradora","nome_produto","operadora","administradora","valor","numero_vidas","valor_total_fatura","vigencia","vencimento"] as const;
type Campo = (typeof CAMPOS)[number];
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const paraOpcaoOuOutro = (valor: string, opcoes: readonly string[]) => {
  if (!valor) return "";
  const encontrada = opcoes.find((o) => o.toLowerCase() === valor.toLowerCase());
  return encontrada ?? "Outro";
};

export function VendaForm({ tipo, venda }: { tipo: Tipo; venda?: Record<string, any> }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const criar = useServerFn(criarVenda);
  const editar = useServerFn(editarVenda);
  const [v, setV] = useState<Record<Campo, string>>(() => {
    const o = {} as Record<Campo, string>;
    CAMPOS.forEach((c) => (o[c] = str(venda?.[c])));
    if (!o.numero_parcelas) o.numero_parcelas = "1";
    if (o.telefone) o.telefone = formatTelefone(o.telefone);
    o.valor_apolice = numeroParaMoeda(venda?.["valor_apolice"]);
    o.valor = numeroParaMoeda(venda?.["valor"]);
    o.valor_total_fatura = numeroParaMoeda(venda?.["valor_total_fatura"]);
    if (tipo === "saude") {
      o.administradora = paraOpcaoOuOutro(o.administradora, ADMINISTRADORAS_SAUDE);
      o.operadora = paraOpcaoOuOutro(o.operadora, OPERADORAS_SAUDE);
    } else if (tipo === "odonto") {
      o.administradora = paraOpcaoOuOutro(o.administradora, ADMINISTRADORAS_ODONTO);
      o.operadora = paraOpcaoOuOutro(o.operadora, OPERADORAS_ODONTO);
    }
    return o;
  });
  const [inclusao, setInclusao] = useState(!!venda?.["inclusao"]);
  const [salvando, setSalvando] = useState(false);
  const set = (k: Campo) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((p) => ({ ...p, [k]: e.target.value }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!v.nome.trim()) { toast.error("O campo Nome é obrigatório."); return; }
    const comum = { nome: v.nome.trim(), email: v.email.trim(), telefone: v.telefone.trim(), cidade: v.cidade.trim() };
    let payload: any;
    if (tipo === "auto") {
      if (!v.produto_auto) { toast.error("Selecione um produto Auto válido."); return; }
      if (!v.forma_pagamento) { toast.error("Selecione uma forma de pagamento válida."); return; }
      payload = { ...comum, produto_auto: v.produto_auto, valor_apolice: parseDecimal(v.valor_apolice), forma_pagamento: v.forma_pagamento, numero_parcelas: parseIntOrNull(v.numero_parcelas) ?? 1, seguradora: v.seguradora.trim() };
    } else {
      payload = {
        ...comum,
        nome_produto: v.nome_produto.trim(),
        operadora: v.operadora.trim(),
        administradora: v.administradora.trim(),
        inclusao,
        valor: parseDecimal(v.valor),
        numero_vidas: parseIntOrNull(v.numero_vidas),
        valor_total_fatura: parseDecimal(v.valor_total_fatura),
        vigencia: v.vigencia || null,
        vencimento: v.vencimento ? Number(v.vencimento) : null,
      };
    }
    setSalvando(true);
    try {
      if (venda) {
        await editar({ data: { id: venda["id"], tipo_produto: tipo, ...payload } });
        toast.success("Venda atualizada com sucesso.");
      } else {
        await criar({ data: { tipo_produto: tipo, ...payload } });
        toast.success("Venda cadastrada com sucesso.");
      }
      qc.invalidateQueries({ queryKey: ["vendas"] });
      navigate({ to: "/vendas" });
    } catch (err: any) {
      toast.error("Erro ao salvar: " + mensagem(err));
    } finally {
      setSalvando(false);
    }
  }

  const F = ({ id, label, type = "text", ...rest }: { id: Campo; label: string; type?: string; [k: string]: any }) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={v[id]} onChange={set(id)} {...rest} />
    </div>
  );
  const M = ({ id, label }: { id: Campo; label: string }) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        placeholder="0,00"
        value={v[id]}
        onChange={(e) => setV((p) => ({ ...p, [id]: formatMoeda(e.target.value) }))}
      />
    </div>
  );
  const sel = "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <form onSubmit={salvar} className="space-y-6 rounded-xl border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold">{venda ? "Editar" : "Nova"} venda · {TIPO_LABEL[tipo]}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="nome">{tipo === "auto" ? "Nome *" : "Nome do titular *"}</Label>
          <Input
            id="nome"
            required
            value={v.nome}
            onChange={(e) => setV((p) => ({ ...p, nome: e.target.value.toUpperCase() }))}
          />
        </div>
        {F({ id: "email", label: "E-mail", type: "email" })}
        <div className="space-y-1.5">
          <Label htmlFor="telefone">Telefone</Label>
          <Input
            id="telefone"
            inputMode="tel"
            placeholder="(27) 99999-9999"
            maxLength={15}
            value={v.telefone}
            onChange={(e) => setV((p) => ({ ...p, telefone: formatTelefone(e.target.value) }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cidade">Cidade</Label>
          <select id="cidade" className={sel} value={v.cidade} onChange={set("cidade")}>
            <option value="">Selecione...</option>
            {CIDADES_ES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
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
          <div className="space-y-1.5">
            <Label htmlFor="seguradora">Seguradora</Label>
            <select id="seguradora" className={sel} value={v.seguradora} onChange={set("seguradora")}>
              <option value="">Selecione...</option>
              {SEGURADORAS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          {M({ id: "valor_apolice", label: "Valor da apólice (R$)" })}
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
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={inclusao} onCheckedChange={(c) => setInclusao(!!c)} />
            {tipo === "saude" ? "Inclusão Saúde" : "Inclusão Odonto"}
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            {F({ id: "nome_produto", label: "Nome do produto" })}
            <div className="space-y-1.5">
              <Label htmlFor="operadora">Operadora</Label>
              <select id="operadora" className={sel} value={v.operadora} onChange={set("operadora")}>
                <option value="">Selecione...</option>
                {(tipo === "saude" ? OPERADORAS_SAUDE : OPERADORAS_ODONTO).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="administradora">Administradora</Label>
              <select id="administradora" className={sel} value={v.administradora} onChange={set("administradora")}>
                <option value="">Selecione...</option>
                {(tipo === "saude" ? ADMINISTRADORAS_SAUDE : ADMINISTRADORAS_ODONTO).map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            {M({ id: "valor", label: "Valor (R$)" })}
            {F({ id: "numero_vidas", label: "Nº de vidas", type: "number", min: 0 })}
            {M({ id: "valor_total_fatura", label: "Valor total da fatura (R$)" })}
            {F({ id: "vigencia", label: "Vigência", type: "date" })}
            <div className="space-y-1.5">
              <Label htmlFor="vencimento">Vencimento</Label>
              <select id="vencimento" className={sel} value={v.vencimento} onChange={set("vencimento")}>
                <option value="">Selecione...</option>
                {VENCIMENTOS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</Button>
        <Button type="button" variant="outline" onClick={() => navigate({ to: "/vendas" })}>Cancelar</Button>
      </div>
    </form>
  );
}
