// Listas fixas de Administradora/Operadora para evitar erro de digitação.
// Para adicionar uma nova opção no futuro, é só incluir mais uma linha aqui.

export const ADMINISTRADORAS_SAUDE = [
  "Benevix",
  "Mediatorie",
  "Up healt",
  "Meridian",
  "Med Brasil",
  "Select",
  "Outro",
] as const;

export const OPERADORAS_SAUDE = [
  "Unimed",
  "Sbs",
  "Samp",
  "Meridional saude",
  "Medsenior",
  "Bestsenior",
  "Select",
  "Outro",
] as const;

export const ADMINISTRADORAS_ODONTO = ["Mediatorie", "Up healt", "Odontoprev", "Outro"] as const;

export const OPERADORAS_ODONTO = ["Unimed", "Samp", "Bradesco", "Outro"] as const;

// Dias de vencimento disponíveis (o campo deixou de ser uma data completa).
export const VENCIMENTOS = [5, 10, 15, 20, 25] as const;
