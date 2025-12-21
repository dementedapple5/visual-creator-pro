-- Allow 'headshot' as a valid generations.mode value
-- Fixes: new row for relation "generations" violates check constraint "generations_mode_check"

alter table public.generations
  drop constraint if exists generations_mode_check;

alter table public.generations
  add constraint generations_mode_check
  check (mode in ('create', 'remix', 'iterate', 'headshot'));


