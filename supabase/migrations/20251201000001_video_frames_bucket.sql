-- Create storage bucket for video frames if it doesn't exist
insert into storage.buckets (id, name, public)
values ('video-frames', 'video-frames', true)
on conflict (id) do nothing;

-- Create storage policy for video frames
create policy "Users can upload frames"
  on storage.objects for insert
  with check (
    bucket_id = 'video-frames' and
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

create policy "Public read access for frames"
  on storage.objects for select
  using (bucket_id = 'video-frames');

