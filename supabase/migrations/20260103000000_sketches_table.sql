-- Create sketches table
create table public.sketches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  data jsonb not null,
  preview_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.sketches enable row level security;

-- Sketches policies
create policy "Users can view own sketches"
  on public.sketches for select
  using (auth.uid() = user_id);

create policy "Users can insert own sketches"
  on public.sketches for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sketches"
  on public.sketches for update
  using (auth.uid() = user_id);

create policy "Users can delete own sketches"
  on public.sketches for delete
  using (auth.uid() = user_id);

-- Storage bucket for sketches
insert into storage.buckets (id, name, public)
values ('sketches', 'sketches', true)
on conflict (id) do nothing;

-- Storage policies for sketches previews
create policy "Users can upload own sketches previews"
  on storage.objects for insert
  with check (
    bucket_id = 'sketches' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Anyone can view sketches previews"
  on storage.objects for select
  using (bucket_id = 'sketches');

create policy "Users can delete own sketches previews"
  on storage.objects for delete
  using (
    bucket_id = 'sketches' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Update timestamp trigger
create trigger update_sketches_updated_at
  before update on public.sketches
  for each row execute procedure public.update_updated_at_column();
