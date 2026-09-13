-- Initial database structure for PintorPro / Asistente personal de Gendy.
-- Safe to apply to a new Supabase project. All application data is tenant-scoped by auth.users.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  phone text,
  email text,
  job_address text,
  quote numeric(12, 2) check (quote is null or quote >= 0),
  agreed_price numeric(12, 2) check (agreed_price is null or agreed_price >= 0),
  payment_status text not null default 'pendiente'
    check (payment_status in ('pendiente', 'parcial', 'cobrado')),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  type text not null default 'otros'
    check (type in ('presupuesto', 'inicio_obra', 'fin_obra', 'cobro', 'otros')),
  event_date date not null,
  event_time time,
  description text,
  email_sent boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  url text not null,
  photo_type text not null default 'antes'
    check (photo_type in ('antes', 'despues')),
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

-- Keep relationships tenant-safe even when a client id is submitted manually.
create or replace function public.validate_client_owner()
returns trigger
language plpgsql
security invoker
as $$
begin
  if new.client_id is not null and not exists (
    select 1
    from public.clients c
    where c.id = new.client_id
      and c.user_id = new.user_id
  ) then
    raise exception 'client_id does not belong to the authenticated user';
  end if;
  return new;
end;
$$;

drop trigger if exists events_validate_client_owner on public.events;
create trigger events_validate_client_owner
before insert or update on public.events
for each row execute function public.validate_client_owner();

drop trigger if exists photos_validate_client_owner on public.photos;
create trigger photos_validate_client_owner
before insert or update on public.photos
for each row execute function public.validate_client_owner();

create index if not exists clients_user_id_created_at_idx
  on public.clients(user_id, created_at desc);
create index if not exists clients_user_id_payment_status_idx
  on public.clients(user_id, payment_status);
create index if not exists events_user_id_event_date_idx
  on public.events(user_id, event_date, event_time);
create index if not exists events_client_id_idx
  on public.events(client_id);
create index if not exists photos_user_id_created_at_idx
  on public.photos(user_id, created_at desc);
create index if not exists photos_client_id_idx
  on public.photos(client_id);

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

alter table public.clients enable row level security;
alter table public.events enable row level security;
alter table public.photos enable row level security;

drop policy if exists "Users can view their clients" on public.clients;
create policy "Users can view their clients"
on public.clients for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their clients" on public.clients;
create policy "Users can create their clients"
on public.clients for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their clients" on public.clients;
create policy "Users can update their clients"
on public.clients for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their clients" on public.clients;
create policy "Users can delete their clients"
on public.clients for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their events" on public.events;
create policy "Users can view their events"
on public.events for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their events" on public.events;
create policy "Users can create their events"
on public.events for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their events" on public.events;
create policy "Users can update their events"
on public.events for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their events" on public.events;
create policy "Users can delete their events"
on public.events for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their photos" on public.photos;
create policy "Users can view their photos"
on public.photos for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their photos" on public.photos;
create policy "Users can create their photos"
on public.photos for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their photos" on public.photos;
create policy "Users can update their photos"
on public.photos for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their photos" on public.photos;
create policy "Users can delete their photos"
on public.photos for delete
to authenticated
using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'work-photos',
  'work-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can view their work photos" on storage.objects;
create policy "Users can view their work photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'work-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can upload their work photos" on storage.objects;
create policy "Users can upload their work photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'work-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can update their work photos" on storage.objects;
create policy "Users can update their work photos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'work-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'work-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Users can delete their work photos" on storage.objects;
create policy "Users can delete their work photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'work-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
