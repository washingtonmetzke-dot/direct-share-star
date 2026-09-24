import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CIDADES_ES } from "@/lib/cidades-es";
import { SEGURADORAS } from "@/lib/seguradoras";

const TIPOS = ["auto", "saude", "odonto"] as const;
const PRODUTOS_AUTO = ["carro", "moto", "caminhao", "bike", "frota"] as const;
const FORMAS_PAGAMENTO = ["cartao", "carne", "pix"] as const;

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Acesso não autorizado.");
}

const numeroOpcional = z.number().finite().min(0, "O valor não pode ser negativo.").nullable().optional();

const comum = z.object({
  nome: z.string().trim().min(1, "O campo Nome é obrigatório.").max(150),
  email: z
    .string()
    .trim()
    .max(150)
    .optional()
    .default("")
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido."),
  telefone: z.string().trim().max(20).optional().default(""),
  cidade: z
    .string()
    .trim()
    .max(120)
    .optional()
    .default("")
    .refine((v) => !v || (CIDADES_ES as readonly string[]).includes(v), "Cidade inválida."),
});

const autoExtra = z.object({
  produto_auto: z
    .string()
    .refine((v) => (PRODUTOS_AUTO as readonly string[]).includes(v), "Selecione um produto Auto válido."),
  valor_apolice: numeroOpcional,
  forma_pagamento: z
    .string()
    .refine((v) => (FORMAS_PAGAMENTO as readonly string[]).includes(v), "Selecione uma forma de pagamento válida."),
  numero_parcelas: z
    .number()
    .int("Número de parcelas inválido.")
    .min(1, "Número de parcelas deve ser pelo menos 1.")
    .max(24, "Número de parcelas deve ser no máximo 24."),
  seguradora: z
    .string()
    .trim()
    .max(120)
    .optional()
    .default("")
    .refine((v) => !v || (SEGURADORAS as readonly string[]).includes(v), "Seguradora inválida."),
});

const saudeOdontoExtra = z.object({
  plano: z.string().trim().max(150).optional().default(""),
  operadora: z.string().trim().max(150).optional().default(""),
  administradora: z.string().trim().max(150).optional().default(""),
  valor: numeroOpcional,
  numero_vidas: z
    .number()
    .int("Número de vidas inválido.")
    .min(0, "Número de vidas não pode ser negativo.")
    .nullable()
    .optional(),
  valor_total_fatura: numeroOpcional,
  vigencia: z.string().nullable().optional(),
  vencimento: z.string().nullable().optional(),
});

function validarVenda(d: any) {
  if (!TIPOS.includes(d?.tipo_produto)) throw new Error("Tipo de produto inválido.");
  const base = comum.parse(d);
  const extra = d.tipo_produto === "auto" ? autoExtra.parse(d) : saudeOdontoExtra.parse(d);
  return { tipo_produto: d.tipo_produto as (typeof TIPOS)[number], ...base, ...extra };
}

export const criarVenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => validarVenda(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("vendas").insert({ ...data, consultor_id: context.userId } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const editarVenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => ({ id: z.string().uuid().parse((d as any).id), ...validarVenda(d) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { id, ...payload } = data;
    const { error } = await context.supabase.from("vendas").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
