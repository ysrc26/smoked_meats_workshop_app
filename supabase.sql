-- =========================================================
-- Extensions
-- =========================================================
create extension if not exists pgcrypto;

-- =========================================================
-- Tables
-- =========================================================

-- workshops
create table if not exists public.workshops (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_at timestamptz not null,
  capacity int not null check (capacity > 0),
  price_cents int not null check (price_cents >= 0),
  payment_link text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ensure new columns exist
alter table public.workshops
  add column if not exists is_public boolean not null default true;

alter table public.workshops
  add column if not exists access_token uuid not null default gen_random_uuid();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'workshops_access_token_unique'
  ) then
    alter table public.workshops
      add constraint workshops_access_token_unique unique (access_token);
  end if;
end$$;

-- registrations
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  seats int not null default 1 check (seats > 0),
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled')),
  paid boolean not null default false,
  payment_link text,
  payment_method text,
  external_payment_id text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public' and table_name='registrations' and column_name='payment_method'
  ) then
    alter table public.registrations
      add column payment_method text
      check (payment_method is null or payment_method in ('cash','card','transfer','other'));
  end if;
end$$;

-- =========================================================
-- View (שומר על השם/העמודות כדי להימנע משגיאת rename)
-- =========================================================
create or replace view public.workshops_with_stats as
select
  w.id,
  w.title,
  w.description,
  w.event_at,
  w.capacity,
  w.price_cents,
  w.payment_link,
  w.is_active,
  w.is_public,
  (
    w.capacity - coalesce((
      select sum(r.seats)
      from public.registrations r
      where r.workshop_id = w.id
        and r.status <> 'cancelled'
    ), 0)
  ) as seats_left
from public.workshops w;

-- =========================================================
-- RLS Policies
-- =========================================================
alter table public.workshops enable row level security;
alter table public.registrations enable row level security;

-- workshops: ציבור רואה רק פומביות/פעילות ולעתיד (או אם נשאר מקום)
drop policy if exists "read_public_workshops" on public.workshops;
create policy "read_public_workshops" on public.workshops
for select
to anon, authenticated
using (
  is_active = true
  and is_public = true
  and (
    event_at >= now()
    or (
      (capacity - coalesce((
        select sum(r.seats)
        from public.registrations r
        where r.workshop_id = workshops.id
          and r.status <> 'cancelled'
      ),0)) > 0
    )
  )
);

-- registrations: ציבור יכול לבצע insert בלבד
drop policy if exists "insert_registration" on public.registrations;
create policy "insert_registration" on public.registrations
for insert
to anon, authenticated
with check (true);

-- =========================================================
-- Grants
-- =========================================================
grant usage on schema public to anon, authenticated;

grant select on table public.workshops to anon, authenticated;
grant select on table public.workshops_with_stats to anon, authenticated;

-- ודא שאין SELECT/UPDATE/DELETE לציבור על registrations (נשאיר ל-service_role דרך ה-API האדמיני)
revoke all on table public.registrations from anon;
revoke all on table public.registrations from authenticated;

-- =========================================================
-- Indexes (אידמפוטנטיים)
-- =========================================================
create index if not exists idx_workshops_event_at on public.workshops(event_at);
create index if not exists idx_workshops_is_active on public.workshops(is_active);
create index if not exists idx_registrations_workshop on public.registrations(workshop_id);
create index if not exists idx_registrations_paid on public.registrations(paid);

-- =========================================================
-- RPC: get_workshop_by_token (לסדנאות פרטיות)
-- =========================================================
create or replace function public.get_workshop_by_token(p_token uuid)
returns table (
  id uuid,
  title text,
  description text,
  event_at timestamptz,
  capacity int,
  price_cents int,
  payment_link text,
  is_active boolean,
  seats_left int
)
language sql
security definer
set search_path = public
as $$
select
  w.id, w.title, w.description, w.event_at, w.capacity, w.price_cents,
  w.payment_link, w.is_active,
  (
    w.capacity - coalesce((
      select sum(r.seats)
      from public.registrations r
      where r.workshop_id = w.id
        and r.status <> 'cancelled'
    ),0)
  ) as seats_left
from public.workshops w
where w.access_token = p_token
group by w.id
limit 1;
$$;

revoke all on function public.get_workshop_by_token(uuid) from public;
grant execute on function public.get_workshop_by_token(uuid) to anon, authenticated;

-- =========================================================
-- ✅ בדיקות (כדי לראות פלט אמיתי אחרי הרצה)
-- =========================================================

-- 1) לראות שהטבלאות קיימות:
select 'tables' as kind, table_name from information_schema.tables
where table_schema='public' and table_name in ('workshops','registrations')
order by table_name;

-- 2) לראות שה-view מחזיר שדות (גם אם עדיין אין נתונים):
select 'view_sample' as kind, * from public.workshops_with_stats limit 5;

-- 3) לבדוק שה-RPC זמינה (אם אין טוקן אמיתי תחזיר 0 שורות, וזה בסדר):
-- select * from public.get_workshop_by_token('00000000-0000-0000-0000-000000000000');
