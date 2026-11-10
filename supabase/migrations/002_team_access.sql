-- Small team (two people): every signed-in user, including the automatic anonymous
-- session each device gets, sees all monitoring records and photos. Writes stay tied
-- to the author (owner_id), as in 001. Also enable Authentication > Sign In / Providers >
-- "Allow anonymous sign-ins" in the Supabase dashboard.
drop policy if exists "owner read monitoring" on public.monitoring_sessions;
create policy "team read monitoring" on public.monitoring_sessions for select to authenticated using (true);
drop policy if exists "owner read detections" on public.detections;
create policy "team read detections" on public.detections for select to authenticated using (true);
drop policy if exists "owner read monitoring images" on storage.objects;
create policy "team read monitoring images" on storage.objects for select to authenticated using (bucket_id = 'monitoring');
