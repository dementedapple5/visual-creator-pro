-- Add aspect_ratio column to thumbnails table
ALTER TABLE public.thumbnails 
ADD COLUMN aspect_ratio text NOT NULL DEFAULT '16:9';