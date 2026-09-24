import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const EMAIL_DOMAIN = "zagal.app";

// Deriva um identificador de login estável a partir do nome (sem acentos,
// espaços ou símbolos), usado como "codigo" interno e para montar o e-mail
// técnico do Supabase Auth. O campo de código não é mais exposto na tela.
export function slugify(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export const toEmail = (codigo: string) => `${codigo}@${EMAIL_DOMAIN}`;

async function proximoCodigoDisponivel(admin: any, nome: string, ignorarId?: string) {
  const base = slugify(nome) || "consultor";
  let codigo = base;
  let sufixo = 2;
  for (;;) {
    const { data } = await admin.from("consultores").select("id").eq("codigo", codigo).maybeSingle();
    if (!data || data.id === ignorarId) return codigo;
    codigo = `${base}${sufixo}`;
    sufixo += 1;
  }
}

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Acesso não autorizado.");
}

// Confere a senha do consultor marcado como "Usuário master", sem afetar a
// sessão de quem está pedindo a confirmação (login de teste descartável,
// isolado, usando só a chave publica — não precisa da service role, nem
// para achar o master nem para conferir a senha).
async function verificarSenhaDoMaster(leitura: any, senha: string): Promise<boolean> {
  const { data: master } = await leitura.from("consultores").select("codigo").eq("is_master", true).maybeSingle();
  if (!master) return false;
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return false;
  const temp = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await temp.auth.signInWithPassword({ email: toEmail(master.codigo), password: senha });
  return !error;
}

export const verificarSenhaMaster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ senha: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const ok = await verificarSenhaDoMaster(context.supabase, data.senha);
    return { ok };
  });

async function adminsAtivos(admin: any) {
  const { data: roles } = await admin.from("user_roles").select("user_id").eq("role", "admin");
  const ids = (roles ?? []).map((r: any) => r.user_id);
  if (!ids.length) return [] as string[];
  const { data } = await admin.from("consultores").select("id").in("id", ids).eq("ativo", true);
  return (data ?? []).map((c: any) => c.id as string);
}

const base = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório.").max(120),
  is_admin: z.boolean(),
  observacao: z.string().max(2000).optional().default(""),
});

export const criarConsultor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => base.extend({ senha: z.string().min(6, "Senha deve ter ao menos 6 caracteres.") }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const codigo = await proximoCodigoDisponivel(supabaseAdmin, data.nome);
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
    base
      .extend({
        id: z.string().uuid(),
        ativo: z.boolean(),
        senha: z.string().optional().default(""),
        is_master: z.boolean().optional().default(false),
        senha_master_atual: z.string().optional().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const codigo = await proximoCodigoDisponivel(supabaseAdmin, data.nome, data.id);
    if (data.senha && data.senha.length < 6) throw new Error("Senha deve ter ao menos 6 caracteres.");

    const ativos = await adminsAtivos(supabaseAdmin);
    if (ativos.length <= 1 && ativos.includes(data.id) && !(data.is_admin && data.ativo)) {
      throw new Error("Não é possível remover o ADM ou desativar o único ADM ativo do sistema.");
    }

    const { data: atual } = await supabaseAdmin.from("consultores").select("is_master, codigo").eq("id", data.id).single();
    const eraMaster = !!atual?.is_master;
    const loginMudou = atual?.codigo !== codigo;

    // Desmarcar o master, desativá-lo, trocar a senha dele, ou renomeá-lo (o
    // que muda o login dele, já que o login é derivado do nome) exige
    // confirmar a senha atual dele.
    const precisaConfirmarSenha = eraMaster && (!data.is_master || !data.ativo || data.senha || loginMudou);
    if (precisaConfirmarSenha) {
      if (!data.senha_master_atual) throw new Error("Digite a senha atual do usuário master para confirmar esta alteração.");
      const ok = await verificarSenhaDoMaster(supabaseAdmin, data.senha_master_atual);
      if (!ok) throw new Error("Senha atual do usuário master incorreta.");
    }
    // Marcar um novo master: só pode haver um no sistema.
    if (!eraMaster && data.is_master) {
      const { data: outro } = await supabaseAdmin.from("consultores").select("id").eq("is_master", true).maybeSingle();
      if (outro) throw new Error("Já existe um usuário master no sistema. Desmarque o atual antes de definir outro.");
    }

    const upd: any = { email: toEmail(codigo), ban_duration: data.ativo ? "none" : "876000h" };
    if (data.senha) upd.password = data.senha;
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, upd);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("consultores").update({ nome: data.nome, codigo, observacao: data.observacao, ativo: data.ativo, is_master: data.is_master }).eq("id", data.id);
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
    const { data: alvo } = await supabaseAdmin.from("consultores").select("is_master").eq("id", data.id).single();
    if (alvo?.is_master) throw new Error("Não é possível excluir: este é o usuário master do sistema.");
    const ativos = await adminsAtivos(supabaseAdmin);
    if (ativos.length <= 1 && ativos.includes(data.id)) throw new Error("Não é possível excluir: este é o único ADM ativo do sistema.");
    const { count } = await supabaseAdmin.from("vendas").select("id", { count: "exact", head: true }).eq("consultor_id", data.id);
    if (count && count > 0) throw new Error("Não é possível excluir: existem vendas cadastradas por este consultor. Desative-o em vez de excluir.");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    await supabaseAdmin.from("consultores").delete().eq("id", data.id);
    await supabaseAdmin.auth.admin.deleteUser(data.id);
    return { ok: true };
  });
