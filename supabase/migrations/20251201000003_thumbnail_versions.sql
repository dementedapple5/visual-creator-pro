create table public.thumbnail_versions (
  id uuid primary key default gen_random_uuid(),
  thumbnail_id uuid references public.thumbnails(id) on delete cascade not null,
  image_url text not null,
  prompt text,
  created_at timestamp with time zone default now()
);

alter table public.thumbnail_versions enable row level security;

create policy "Users can view own thumbnail versions"
  on public.thumbnail_versions for select
  using (
    exists (
      select 1 from public.thumbnails
      where thumbnails.id = thumbnail_versions.thumbnail_id
      and thumbnails.user_id = auth.uid()
    )
  );

create policy "Users can insert own thumbnail versions"
  on public.thumbnail_versions for insert
  with check (
    exists (
      select 1 from public.thumbnails
      where thumbnails.id = thumbnail_versions.thumbnail_id
      and thumbnails.user_id = auth.uid()
    )
  );

create policy "Users can delete own thumbnail versions"
  on public.thumbnail_versions for delete
  using (
    exists (
      select 1 from public.thumbnails
      where thumbnails.id = thumbnail_versions.thumbnail_id
      and thumbnails.user_id = auth.uid()
    )
  );

-- Backfill existing thumbnails as first version
insert into public.thumbnail_versions (thumbnail_id, image_url, created_at)
select id, image_url, created_at from public.thumbnails;

