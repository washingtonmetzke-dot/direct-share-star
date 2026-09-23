import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const EMAIL_DOMAIN = "zagal.app";
const toEmail = (codigo: string) => `${codigo.trim().toLowerCase()}@${EMAIL_DOMAIN}`;

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Acesso não autorizado.");
}

async function adminsAtivos(admin: any) {
  const { data: roles } = await admin.from("user_roles").select("user_id").eq("role", "admin");
  const ids = (roles ?? []).map((r: any) => r.user_id);
  if (!ids.length) return [] as string[];
  const { data } = await admin.from("consultores").select("id").in("id", ids).eq("ativo", true);
  return (data ?? []).map((c: any) => c.id as string);
}

// Cria o usuário master (zagal / zagal0077) caso ainda não exista. Idempotente.
export const garantirMaster = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existe } = await supabaseAdmin.from("consultores").select("id").eq("codigo", "zagal").maybeSingle();
  if (existe) return { ok: true };
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: toEmail("zagal"),
    password: "zagal0077",
    email_confirm: true,
  });
  if (error || !data.user) return { ok: false };
  await supabaseAdmin.from("consultores").insert({
    id: data.user.id, nome: "Zagal", codigo: "zagal", observacao: "Usuário master do sistema.", ativo: true,
  });
  await supabaseAdmin.from("user_roles").insert({ user_id: data.user.id, role: "admin" });
  return { ok: true };
});

const base = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório.").max(120),
  codigo: z.string().trim().min(1, "Código é obrigatório.").max(30).regex(/^[a-zA-Z0-9._-]+$/, "Código deve conter apenas letras, números, ponto, hífen ou sublinhado."),
  is_admin: z.boolean(),
  observacao: z.string().max(2000).optional().default(""),
});

export const criarConsultor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => base.extend({ senha: z.string().min(6, "Senha deve ter ao menos 6 caracteres.") }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const codigo = data.codigo.toLowerCase();
    const { data: dup } = await supabaseAdmin.from("consultores").select("id").eq("codigo", codigo).maybeSingle();
    if (dup) throw new Error("Já existe um consultor com esse código.");
    const { data: u, error } = await supabaseAdmin.auth.admin.createUser({
      email: toEmail(codigo), password: data.senha, email_confirm: true,
    });
    if (error || !u.user) throw new Error(error?.message ?? "Erro ao criar consultor.");
    await supabaseAdmin.from("consultores").insert({ id: u.user.id, nome: data.nome, codigo, observacao: data.observacao, ativo: true });
    if (data.is_admin) await supabaseAdmin.from("user_roles").insert({ user_id: u.user.id, role: "admin" });
    return { ok: true };
  });

export const editarConsultor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) =>
    base.extend({ id: z.string().uuid(), ativo: z.boolean(), senha: z.string().optional().default("") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const codigo = data.codigo.toLowerCase();
    const { data: dup } = await supabaseAdmin.from("consultores").select("id").eq("codigo", codigo).maybeSingle();
    if (dup && dup.id !== data.id) throw new Error("Já existe um consultor com esse código.");
    if (data.senha && data.senha.length < 6) throw new Error("Senha deve ter ao menos 6 caracteres.");

    const ativos = await adminsAtivos(supabaseAdmin);
    if (ativos.length <= 1 && ativos.includes(data.id) && !(data.is_admin && data.ativo)) {
      throw new Error("Não é possível remover o ADM ou desativar o único ADM ativo do sistema.");
    }

    const upd: any = { email: toEmail(codigo), ban_duration: data.ativo ? "none" : "876000h" };
    if (data.senha) upd.password = data.senha;
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, upd);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("consultores").update({ nome: data.nome, codigo, observacao: data.observacao, ativo: data.ativo }).eq("id", data.id);
    if (data.is_admin) await supabaseAdmin.from("user_roles").upsert({ user_id: data.id, role: "admin" }, { onConflict: "user_id,role" });
    else await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id).eq("role", "admin");
    return { ok: true };
  });

export const excluirConsultor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ativos = await adminsAtivos(supabaseAdmin);
    if (ativos.length <= 1 && ativos.includes(data.id)) throw new Error("Não é possível excluir: este é o único ADM ativo do sistema.");
    const { count } = await supabaseAdmin.from("vendas").select("id", { count: "exact", head: true }).eq("consultor_id", data.id);
    if (count && count > 0) throw new Error("Não é possível excluir: existem vendas cadastradas por este consultor. Desative-o em vez de excluir.");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    await supabaseAdmin.from("consultores").delete().eq("id", data.id);
    await supabaseAdmin.auth.admin.deleteUser(data.id);
    return { ok: true };
  });
