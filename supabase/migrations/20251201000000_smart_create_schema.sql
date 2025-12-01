-- Create smart_create_jobs table
create table public.smart_create_jobs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  source_type text not null check (source_type in ('youtube', 'upload')),
  source_url text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  error_message text
);

-- Enable RLS for smart_create_jobs
alter table public.smart_create_jobs enable row level security;

create policy "Users can view their own jobs"
  on public.smart_create_jobs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own jobs"
  on public.smart_create_jobs for insert
  with check (auth.uid() = user_id);

-- Create smart_create_suggestions table
create table public.smart_create_suggestions (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.smart_create_jobs(id) on delete cascade not null,
  frame_url text not null,
  title text,
  subtitle text,
  timestamp float,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for smart_create_suggestions
alter table public.smart_create_suggestions enable row level security;

create policy "Users can view suggestions for their jobs"
  on public.smart_create_suggestions for select
  using (
    exists (
      select 1 from public.smart_create_jobs
      where id = smart_create_suggestions.job_id
      and user_id = auth.uid()
    )
  );

-- Create storage bucket for videos if it doesn't exist
insert into storage.buckets (id, name, public)
values ('smart-create-videos', 'smart-create-videos', false)
on conflict (id) do nothing;

-- Create storage policy for videos
create policy "Users can upload videos"
  on storage.objects for insert
  with check (
    bucket_id = 'smart-create-videos' and
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

create policy "Users can read their own videos"
  on storage.objects for select
  using (
    bucket_id = 'smart-create-videos' and
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

