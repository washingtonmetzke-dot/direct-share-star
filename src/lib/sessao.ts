import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Sessao = { id: string; nome: string; codigo: string; isAdmin: boolean };

export function useSessao() {
  return useQuery({
    queryKey: ["sessao"],
    queryFn: async (): Promise<Sessao | null> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [{ data: c }, { data: isAdmin }] = await Promise.all([
        supabase.from("consultores").select("id,nome,codigo").eq("id", u.user.id).maybeSingle(),
        supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" }),
      ]);
      return { id: u.user.id, nome: c?.nome ?? "", codigo: c?.codigo ?? "", isAdmin: !!isAdmin };
    },
  });
}

export const TIPO_LABEL: Record<string, string> = { auto: "Auto", saude: "Saúde", odonto: "Odonto" };

export function parseDecimal(v: string): number | null {
  if (!v) return null;
  let t = v.trim();
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
export function parseIntOrNull(v: string): number | null {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}
