-- Add font_style_id column to titles table to reference font style images
alter table public.titles 
  add column font_style_id uuid references public.font_styles(id) on delete set null;

-- Index for faster lookups
create index titles_font_style_id_idx on public.titles (font_style_id);

