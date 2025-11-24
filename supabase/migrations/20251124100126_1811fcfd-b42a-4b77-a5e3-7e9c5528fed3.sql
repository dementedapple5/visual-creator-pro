-- Create profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;

-- Profile policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Create avatars table
create table public.avatars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  image_url text not null,
  created_at timestamp with time zone default now()
);

alter table public.avatars enable row level security;

-- Avatar policies
create policy "Users can view own avatars"
  on public.avatars for select
  using (auth.uid() = user_id);

create policy "Users can insert own avatars"
  on public.avatars for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own avatars"
  on public.avatars for delete
  using (auth.uid() = user_id);

-- Create products table
create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  image_url text not null,
  created_at timestamp with time zone default now()
);

alter table public.products enable row level security;

-- Product policies
create policy "Users can view own products"
  on public.products for select
  using (auth.uid() = user_id);

create policy "Users can insert own products"
  on public.products for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own products"
  on public.products for delete
  using (auth.uid() = user_id);

-- Create thumbnails table
create table public.thumbnails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text,
  subtitle text,
  avatar_id uuid references public.avatars(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  expression text,
  visual_style text not null,
  text_style text not null,
  background_type text not null,
  background_value text,
  image_url text not null,
  created_at timestamp with time zone default now()
);

alter table public.thumbnails enable row level security;

-- Thumbnail policies
create policy "Users can view own thumbnails"
  on public.thumbnails for select
  using (auth.uid() = user_id);

create policy "Users can insert own thumbnails"
  on public.thumbnails for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own thumbnails"
  on public.thumbnails for delete
  using (auth.uid() = user_id);

-- Create storage buckets
insert into storage.buckets (id, name, public)
values 
  ('avatars', 'avatars', true),
  ('products', 'products', true),
  ('thumbnails', 'thumbnails', true)
on conflict (id) do nothing;

-- Storage policies for avatars
create policy "Users can upload own avatars"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can delete own avatars"
  on storage.objects for delete
  using (
    bucket_id = 'avatars' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for products
create policy "Users can upload own products"
  on storage.objects for insert
  with check (
    bucket_id = 'products' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Anyone can view products"
  on storage.objects for select
  using (bucket_id = 'products');

create policy "Users can delete own products"
  on storage.objects for delete
  using (
    bucket_id = 'products' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for thumbnails
create policy "Users can upload own thumbnails"
  on storage.objects for insert
  with check (
    bucket_id = 'thumbnails' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Anyone can view thumbnails"
  on storage.objects for select
  using (bucket_id = 'thumbnails');

create policy "Users can delete own thumbnails"
  on storage.objects for delete
  using (
    bucket_id = 'thumbnails' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Trigger to auto-create profile
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Update timestamp trigger
create function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.update_updated_at_column();