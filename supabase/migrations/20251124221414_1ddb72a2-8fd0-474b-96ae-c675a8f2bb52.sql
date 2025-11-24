-- Add username column to profiles table
ALTER TABLE public.profiles ADD COLUMN username TEXT;

-- Add a unique constraint on username to prevent duplicates
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);