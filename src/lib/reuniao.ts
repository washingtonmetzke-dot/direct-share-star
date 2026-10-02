import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Reuniao = { titulo: string; descricao: string; data: string | null; hora: string; local: string; ativa: boolean };

export function useReuniao() {
  return useQuery({
    queryKey: ["reuniao"],
    queryFn: async (): Promise<Reuniao | null> => {
      const { data } = await supabase.from("reuniao").select("titulo,descricao,data,hora,local,ativa").eq("id", 1).maybeSingle();
      return data ?? null;
    },
  });
}

export function dataBR(d: string | null | undefined) {
  if (!d) return "";
  const [y, m, dia] = d.split("-");
  return `${dia}/${m}/${y}`;
}
