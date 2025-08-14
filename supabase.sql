-- טבלאות בסיס
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

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  seats int not null default 1 check (seats > 0),
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled')),
  paid boolean not null default false,
  external_payment_id text,
  created_at timestamptz not null default now()
);

-- View לחישוב זמינות
create or replace view public.workshops_with_stats as
select w.*,
  coalesce((select sum(seats) from registrations r where r.workshop_id = w.id and r.status <> 'cancelled'),0) as seats_taken,
  (w.capacity - coalesce((select sum(seats) from registrations r where r.workshop_id = w.id and r.status <> 'cancelled'),0)) as seats_left
from workshops w;

-- הפעלת RLS
alter table public.workshops enable row level security;
alter table public.registrations enable row level security;

-- מדיניות קריאה: כל אחד יכול לראות סדנאות פעילות שעתידיות או עם מקומות פנויים
create policy "read_public_workshops" on public.workshops
for select
using (
  is_active = true and (event_at >= now() or (select (capacity - coalesce(sum(seats),0)) from registrations where workshop_id = workshops.id and status <> 'cancelled') > 0)
);

-- מדיניות קריאה על view (נדרשת הרשאה על טבלאות הבסיס)
grant select on table public.workshops_with_stats to anon, authenticated;

-- מדיניות הרשמה: מותר לכל אחד להוסיף רישום, בלי לחשוף רישומים
create policy "insert_registration" on public.registrations
for insert
with check (true);

-- מניעת select/delete/update לציבור על registrations
revoke all on table public.registrations from anon;
revoke all on table public.registrations from authenticated;

-- הרשאות בסיסיות על workshops
grant select on table public.workshops to anon, authenticated;

-- אינדקסים שימושיים
create index if not exists idx_registrations_workshop on public.registrations(workshop_id);
create index if not exists idx_workshops_event_at on public.workshops(event_at);