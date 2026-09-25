import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Acesso não autorizado.");
}

const nomeGrupo = z.string().trim().min(1, "Nome do grupo é obrigatório.").max(120);

export const criarGrupo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ nome: nomeGrupo }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("grupos").insert({ nome: data.nome });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const editarGrupo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ id: z.string().uuid(), nome: nomeGrupo }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("grupos").update({ nome: data.nome }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirGrupo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { count } = await context.supabase
      .from("consultores")
      .select("id", { count: "exact", head: true })
      .eq("grupo_id", data.id);
    if (count && count > 0) throw new Error("Não é possível excluir: existem consultores vinculados a este grupo.");
    const { error } = await context.supabase.from("grupos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
