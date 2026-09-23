create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "own roles or admin" on public.user_roles for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create table public.consultores (
  id uuid primary key,
  nome text not null,
  codigo text not null unique,
  observacao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
grant select on public.consultores to authenticated;
grant all on public.consultores to service_role;
alter table public.consultores enable row level security;
create policy "own or admin read" on public.consultores for select to authenticated
using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create table public.vendas (
  id uuid primary key default gen_random_uuid(),
  tipo_produto text not null check (tipo_produto in ('auto','saude','odonto')),
  nome text not null,
  email text, telefone text, cidade text,
  consultor_id uuid not null references public.consultores(id) default auth.uid(),
  data_cadastro timestamptz not null default now(),
  produto_auto text, valor_apolice numeric(12,2), forma_pagamento text, numero_parcelas int, seguradora text,
  plano text, operadora text, administradora text, nome_produtor text, valor numeric(12,2),
  numero_vidas int, valor_total_fatura numeric(12,2), vigencia date, vencimento date
);
grant select, insert, update, delete on public.vendas to authenticated;
grant all on public.vendas to service_role;
alter table public.vendas enable row level security;
create policy "read own or admin" on public.vendas for select to authenticated
using (consultor_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "insert own" on public.vendas for insert to authenticated
with check (consultor_id = auth.uid());
create policy "admin update" on public.vendas for update to authenticated
using (public.has_role(auth.uid(), 'admin'));
create policy "admin delete" on public.vendas for delete to authenticated
using (public.has_role(auth.uid(), 'admin'));
create index on public.vendas (consultor_id, data_cadastro desc);