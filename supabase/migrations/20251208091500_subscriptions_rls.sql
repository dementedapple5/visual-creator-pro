-- Enable RLS and add safe policies for subscriptions table
alter table public.subscriptions enable row level security;

-- Allow service role full access (used by backend functions / server key)
create policy "Service role can manage subscriptions"
  on public.subscriptions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Allow authenticated users to read subscriptions linked to them via user_subscriptions
create policy "Users can read their linked subscriptions"
  on public.subscriptions
  for select
  using (
    exists (
      select 1
      from public.user_subscriptions us
      where us.subscription_id = public.subscriptions.id
        and us.user_id = auth.uid()
    )
  );

