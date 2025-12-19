-- Add credits_used column to generations table
alter table public.generations 
add column credits_used integer not null default 1;

-- Update existing records to have credits_used = 1 (already covered by default but being explicit)
update public.generations set credits_used = 1 where credits_used is null;



