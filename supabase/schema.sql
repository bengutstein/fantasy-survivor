-- Run this once in Supabase: SQL Editor → New query → Run.
create table if not exists public.league_state (
  id smallint primary key check (id = 1),
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.league_state enable row level security;
