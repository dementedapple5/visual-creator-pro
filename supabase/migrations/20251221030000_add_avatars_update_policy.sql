-- Allow users to update their own avatar rows (needed for headshot flow)
-- Note: RLS does not automatically grant UPDATE; it requires an explicit policy.

do $$
begin
  -- Best effort: drop the policy if it already exists (idempotent-ish for dev runs)
  begin
    execute 'drop policy if exists "Users can update own avatars" on public.avatars';
  exception
    when undefined_table then null;
  end;

  execute '
    create policy "Users can update own avatars"
      on public.avatars for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id)
  ';
end $$;


