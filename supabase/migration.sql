-- Newsletter Editor: Supabase Migration
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- 1. Create templates table
create table if not exists public.templates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null default 'Untitled',
  blocks     jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Indexes
create index if not exists idx_templates_user_id on public.templates(user_id);
create index if not exists idx_templates_user_updated on public.templates(user_id, updated_at desc);

-- 3. Auto-update updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on public.templates;
create trigger set_updated_at
  before update on public.templates
  for each row
  execute function public.handle_updated_at();

-- 4. Enable Row Level Security
alter table public.templates enable row level security;

-- 5. RLS Policies — users can only access their own templates
create policy "Users can view own templates"
  on public.templates for select
  using (auth.uid() = user_id);

create policy "Users can insert own templates"
  on public.templates for insert
  with check (auth.uid() = user_id);

create policy "Users can update own templates"
  on public.templates for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own templates"
  on public.templates for delete
  using (auth.uid() = user_id);
