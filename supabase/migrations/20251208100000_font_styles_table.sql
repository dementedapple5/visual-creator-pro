-- Font styles table for storing font style images (both system and user-uploaded)
create table public.font_styles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  image_url text not null,
  is_system boolean not null default false,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.font_styles enable row level security;

-- Everyone can view system font styles
create policy "Anyone can view system font styles"
  on public.font_styles for select
  using (is_system = true);

-- Users can view their own font styles
create policy "Users can view their own font styles"
  on public.font_styles for select
  using (user_id = auth.uid());

-- Users can insert their own font styles (not system ones)
create policy "Users can insert their own font styles"
  on public.font_styles for insert
  with check (user_id = auth.uid() and is_system = false);

-- Users can update their own font styles
create policy "Users can update their own font styles"
  on public.font_styles for update
  using (user_id = auth.uid() and is_system = false);

-- Users can delete their own font styles
create policy "Users can delete their own font styles"
  on public.font_styles for delete
  using (user_id = auth.uid() and is_system = false);

-- Index for faster queries
create index font_styles_user_id_idx on public.font_styles (user_id);
create index font_styles_is_system_idx on public.font_styles (is_system);

