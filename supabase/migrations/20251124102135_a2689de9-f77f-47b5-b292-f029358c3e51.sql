-- Add RLS policy to allow users to update their own thumbnails
CREATE POLICY "Users can update own thumbnails"
ON public.thumbnails
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);