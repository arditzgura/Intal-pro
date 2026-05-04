-- ============================================================
--  INTAL PRO — Supabase Database Setup
--  Ekzekuto këtë në: Supabase Dashboard → SQL Editor
-- ============================================================

-- Tabela: clients
create table if not exists public.clients (
  id         text primary key,
  user_id    text not null,
  data       jsonb not null,
  updated_at timestamptz default now()
);
create index if not exists clients_user_id_idx on public.clients(user_id);

-- Tabela: items
create table if not exists public.items (
  id         text primary key,
  user_id    text not null,
  data       jsonb not null,
  updated_at timestamptz default now()
);
create index if not exists items_user_id_idx on public.items(user_id);

-- Tabela: invoices
create table if not exists public.invoices (
  id         text primary key,
  user_id    text not null,
  data       jsonb not null,
  updated_at timestamptz default now()
);
create index if not exists invoices_user_id_idx on public.invoices(user_id);

-- Tabela: stock_entries
create table if not exists public.stock_entries (
  id         text primary key,
  user_id    text not null,
  data       jsonb not null,
  updated_at timestamptz default now()
);
create index if not exists stock_entries_user_id_idx on public.stock_entries(user_id);

-- Tabela: user_config
create table if not exists public.user_config (
  user_id    text primary key,
  data       jsonb not null,
  updated_at timestamptz default now()
);

-- ============================================================
--  RLS: Çaktivizo (ne përdorim auth të brendshëm, jo Supabase Auth)
--  Kjo lejon anon key të lexojë/shkruajë (e sigurt për app privat)
-- ============================================================
alter table public.clients      disable row level security;
alter table public.items        disable row level security;
alter table public.invoices     disable row level security;
alter table public.stock_entries disable row level security;
alter table public.user_config  disable row level security;

-- ============================================================
--  Trigger: auto-update updated_at
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create or replace trigger clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

create or replace trigger items_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

create or replace trigger invoices_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

create or replace trigger stock_entries_updated_at
  before update on public.stock_entries
  for each row execute function public.set_updated_at();

create or replace trigger user_config_updated_at
  before update on public.user_config
  for each row execute function public.set_updated_at();
