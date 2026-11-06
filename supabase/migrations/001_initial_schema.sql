-- Prototype: authenticated staff share master data; monitoring records belong to their author.
create extension if not exists pgcrypto;
create table public.greenhouse (
 id uuid primary key default gen_random_uuid(), code text unique not null check (code ~ '^[A-Za-z0-9_-]+$'),
 name text not null, location text, active boolean not null default true, created_at timestamptz not null default now()
);
create table public.yellow_traps (
 id uuid primary key default gen_random_uuid(), greenhouse_id uuid not null references public.greenhouse(id),
 trap_code text not null check (trap_code ~ '^[A-Za-z0-9_-]+$'), qr_code text unique not null,
 location_description text, installation_date date, active boolean not null default true,
 created_at timestamptz not null default now(), unique(greenhouse_id,trap_code)
);
create table public.monitoring_sessions (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id),
 trap_id uuid not null references public.yellow_traps(id), captured_at timestamptz not null,
 trap_installed_at timestamptz, exposure_days numeric check (exposure_days>0),
 bemisia_count integer not null check (bemisia_count>=0), previous_count integer, count_difference integer, percent_change numeric,
 bemisia_per_day numeric, previous_bemisia_per_day numeric, rate_change_percent numeric,
 image_quality_score numeric check (image_quality_score between 0 and 100), image_quality_status text not null check (image_quality_status in ('GOOD','WARNING','RETAKE')),
 mean_confidence numeric, min_confidence numeric, max_confidence numeric,
 model_version text not null, original_image_url text, detection_image_url text, notes text,
 feedback_status text not null default 'unreviewed' check (feedback_status in ('unreviewed','correct','needs_review')),
 image_width integer, image_height integer, tile_count integer, inference_time_ms numeric, total_processing_time_ms numeric,
 created_at timestamptz not null default now()
);
create index monitoring_trap_date on public.monitoring_sessions(trap_id,captured_at desc);
create index monitoring_owner on public.monitoring_sessions(owner_id);
create table public.detections (
 id uuid primary key default gen_random_uuid(), monitoring_session_id uuid not null references public.monitoring_sessions(id) on delete cascade,
 detection_index integer not null, confidence numeric not null check (confidence between 0 and 1),
 x numeric not null check(x between 0 and 1), y numeric not null check(y between 0 and 1),
 width numeric not null check(width between 0 and 1), height numeric not null check(height between 0 and 1),
 unique(monitoring_session_id,detection_index)
);
alter table public.greenhouse enable row level security;
alter table public.yellow_traps enable row level security;
alter table public.monitoring_sessions enable row level security;
alter table public.detections enable row level security;
grant select,insert,update on public.greenhouse,public.yellow_traps,public.monitoring_sessions,public.detections to authenticated;
revoke all on public.greenhouse,public.yellow_traps,public.monitoring_sessions,public.detections from anon;
create policy "staff read greenhouse" on public.greenhouse for select to authenticated using(true);
create policy "staff add greenhouse" on public.greenhouse for insert to authenticated with check(true);
create policy "staff update greenhouse" on public.greenhouse for update to authenticated using(true) with check(true);
create policy "staff read traps" on public.yellow_traps for select to authenticated using(true);
create policy "staff add traps" on public.yellow_traps for insert to authenticated with check(true);
create policy "staff update traps" on public.yellow_traps for update to authenticated using(true) with check(true);
create policy "owner read monitoring" on public.monitoring_sessions for select to authenticated using(owner_id=auth.uid());
create policy "owner add monitoring" on public.monitoring_sessions for insert to authenticated with check(owner_id=auth.uid());
create policy "owner retry monitoring" on public.monitoring_sessions for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy "owner read detections" on public.detections for select to authenticated using(exists(select 1 from public.monitoring_sessions s where s.id=monitoring_session_id and s.owner_id=auth.uid()));
create policy "owner add detections" on public.detections for insert to authenticated with check(exists(select 1 from public.monitoring_sessions s where s.id=monitoring_session_id and s.owner_id=auth.uid()));
create policy "owner retry detections" on public.detections for update to authenticated using(exists(select 1 from public.monitoring_sessions s where s.id=monitoring_session_id and s.owner_id=auth.uid())) with check(exists(select 1 from public.monitoring_sessions s where s.id=monitoring_session_id and s.owner_id=auth.uid()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('monitoring','monitoring',false,10485760,array['image/webp','image/jpeg','image/png']) on conflict(id) do nothing;
-- Object owner_id is assigned by Storage from the authenticated uploader, never from client metadata.
create policy "owner upload monitoring images" on storage.objects for insert to authenticated with check(bucket_id='monitoring' and owner_id=auth.uid()::text);
create policy "owner read monitoring images" on storage.objects for select to authenticated using(bucket_id='monitoring' and owner_id=auth.uid()::text);
create policy "owner retry monitoring images" on storage.objects for update to authenticated using(bucket_id='monitoring' and owner_id=auth.uid()::text) with check(bucket_id='monitoring' and owner_id=auth.uid()::text);
