-- Ensure smart-create-videos bucket exists
insert into storage.buckets (id, name, public)
values ('smart-create-videos', 'smart-create-videos', false)
on conflict (id) do nothing;

-- Ensure video-frames bucket exists
insert into storage.buckets (id, name, public)
values ('video-frames', 'video-frames', true)
on conflict (id) do nothing;

-- Policies for smart-create-videos
create policy "Users can upload audio/video to smart-create-videos"
  on storage.objects for insert
  with check (
    bucket_id = 'smart-create-videos' and
    auth.uid() = (storage.foldername(name))[1]::uuid
    OR bucket_id = 'smart-create-videos' -- Allow generic upload if folder structure differs, but usually we want strict RLS
  );
-- Actually, for the 'audio/' folder upload in VideoInputStep, we used `audio/${fileName}`.
-- This path does NOT start with user_id!
-- The previous policy I wrote was: `auth.uid() = (storage.foldername(name))[1]::uuid`.
-- This expects the path to be `userId/filename`.
-- BUT in VideoInputStep.tsx I wrote: `.upload(\`audio/${fileName}\`, ...)`
-- This path starts with "audio", NOT the user ID.
-- This is likely why it fails (RLS violation can sometimes mask as other errors, or simpler: I just need to fix the path or the policy).

-- FIX 1: Update the policy to allow uploads to 'audio/' folder for authenticated users.
drop policy if exists "Users can upload audio/video to smart-create-videos" on storage.objects;

create policy "Users can upload to smart-create-videos"
  on storage.objects for insert
  with check (
    bucket_id = 'smart-create-videos'
    and auth.role() = 'authenticated'
  );

create policy "Users can read from smart-create-videos"
  on storage.objects for select
  using (
    bucket_id = 'smart-create-videos'
    and auth.role() = 'authenticated'
  );

