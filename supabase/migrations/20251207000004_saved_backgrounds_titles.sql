-- Saved backgrounds for reuse
create table public.backgrounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  type text not null,
  value text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

alter table public.backgrounds enable row level security;

create policy "Users can view their backgrounds"
  on public.backgrounds for select
  using (user_id = auth.uid());

create policy "Users can insert their backgrounds"
  on public.backgrounds for insert
  with check (user_id = auth.uid());

create policy "Users can update their backgrounds"
  on public.backgrounds for update
  using (user_id = auth.uid());

create policy "Users can delete their backgrounds"
  on public.backgrounds for delete
  using (user_id = auth.uid());

create index backgrounds_user_id_idx on public.backgrounds (user_id);

-- Saved titles for reuse
create table public.titles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  title text not null,
  subtitle text,
  text_style text not null default 'Bold & Large',
  custom_text_style text,
  text_position text not null default 'top-center',
  created_at timestamp with time zone default now()
);

alter table public.titles enable row level security;

create policy "Users can view their titles"
  on public.titles for select
  using (user_id = auth.uid());

create policy "Users can insert their titles"
  on public.titles for insert
  with check (user_id = auth.uid());

create policy "Users can update their titles"
  on public.titles for update
  using (user_id = auth.uid());

create policy "Users can delete their titles"
  on public.titles for delete
  using (user_id = auth.uid());

create index titles_user_id_idx on public.titles (user_id);

