-- Drop the old name column and add title and brand
ALTER TABLE public.products DROP COLUMN IF EXISTS name;
ALTER TABLE public.products DROP COLUMN IF EXISTS image_url;
ALTER TABLE public.products ADD COLUMN title TEXT NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN brand TEXT NOT NULL DEFAULT '';

-- Create product_images table for multiple images per product
CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS on product_images
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- Create policies for product_images
CREATE POLICY "Users can view own product images"
  ON public.product_images
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own product images"
  ON public.product_images
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own product images"
  ON public.product_images
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_user_id ON public.product_images(user_id);