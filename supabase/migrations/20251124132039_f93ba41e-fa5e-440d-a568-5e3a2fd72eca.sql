-- Add positioning and importance fields to thumbnails table
ALTER TABLE public.thumbnails 
ADD COLUMN avatar_position TEXT,
ADD COLUMN avatar_importance INTEGER DEFAULT 3 CHECK (avatar_importance >= 1 AND avatar_importance <= 5),
ADD COLUMN product_position TEXT,
ADD COLUMN product_importance INTEGER DEFAULT 3 CHECK (product_importance >= 1 AND product_importance <= 5),
ADD COLUMN text_position TEXT,
ADD COLUMN text_importance INTEGER DEFAULT 3 CHECK (text_importance >= 1 AND text_importance <= 5);