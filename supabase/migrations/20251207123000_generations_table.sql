create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  status text not null default 'processing' check (status in ('pending', 'processing', 'completed', 'failed')),
  mode text not null check (mode in ('create', 'remix', 'iterate')),
  request jsonb,
  image_url text,
  thumbnail_id uuid references public.thumbnails(id) on delete set null,
  prompt text,
  remix_prompt text,
  aspect_ratio text,
  title text,
  subtitle text,
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed_at timestamp with time zone,
  duration_ms integer
);

alter table public.generations enable row level security;

create policy "Users can view their own generations"
  on public.generations for select
  using (auth.uid() = user_id);

create policy "Users can insert their own generations"
  on public.generations for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own generations"
  on public.generations for update
  using (auth.uid() = user_id);

create index generations_user_created_idx on public.generations (user_id, created_at desc);
create index generations_user_status_idx on public.generations (user_id, status);

