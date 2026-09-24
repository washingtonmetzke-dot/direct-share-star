export function formatTelefone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// Maior valor (R$) aceito em qualquer campo de valor do sistema.
export const VALOR_MAXIMO = 999999999.99;

// Máscara de valor em reais no estilo "calculadora": os dígitos digitados
// preenchem da direita pra esquerda, os 2 últimos sempre são os centavos.
// Ex.: digitando 1,5,0,0,0,0 vira "1.500,00".
export function formatMoeda(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (!digits) return "";
  digits = digits.slice(0, 11); // trava em 999.999.999,99 (9 dígitos inteiros + 2 de centavos)
  digits = digits.padStart(3, "0");
  const centavos = digits.slice(-2);
  const inteiroBruto = digits.slice(0, -2).replace(/^0+(?=\d)/, "");
  const inteiro = (inteiroBruto || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${inteiro},${centavos}`;
}

// Formata um número já salvo (ex.: vindo do banco, às vezes como string)
// no mesmo padrão da máscara, para preencher o campo ao editar uma venda.
export function numeroParaMoeda(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "";
  const num = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(num)) return "";
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
