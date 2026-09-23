import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lord Corretora · Cadastro de Vendas" },
      { name: "description", content: "Sistema interno de cadastro de vendas Auto, Saúde e Odonto." },
      { property: "og:title", content: "Lord Corretora · Cadastro de Vendas" },
      { property: "og:description", content: "Sistema interno de cadastro de vendas Auto, Saúde e Odonto." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/vendas" });
  },
});
