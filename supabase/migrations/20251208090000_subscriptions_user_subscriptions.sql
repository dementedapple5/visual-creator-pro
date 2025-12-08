-- Subscriptions metadata sourced from Stripe
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  stripe_subscription_id text unique,
  stripe_customer_id text,
  stripe_product_id text,
  stripe_price_id text,
  interval text check (interval in ('month', 'year')),
  status text check (status in ('active', 'canceled', 'past_due', 'incomplete', 'trialing', 'unpaid', 'paused')),
  monthly_limit integer,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index subscriptions_interval_status_idx on public.subscriptions (interval, status);
create index subscriptions_period_end_idx on public.subscriptions (current_period_end desc);

-- Per-user linkage to a subscription with monthly reset tracking (even for yearly plans)
create table public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  subscription_id uuid references public.subscriptions(id) on delete cascade not null,
  start_date timestamp with time zone not null,
  end_date timestamp with time zone,
  reset_date timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, subscription_id)
);

comment on column public.user_subscriptions.reset_date is 'Monthly generation reset date even for yearly Stripe subscriptions.';

alter table public.user_subscriptions enable row level security;

create policy "Users can view their own user_subscriptions"
  on public.user_subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own user_subscriptions"
  on public.user_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own user_subscriptions"
  on public.user_subscriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index user_subscriptions_user_idx on public.user_subscriptions (user_id, reset_date);
create index user_subscriptions_subscription_idx on public.user_subscriptions (subscription_id);

