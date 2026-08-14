create table if not exists public.settings (
  id boolean primary key default true,
  team text not null default 'Houten Heren 1',
  goal numeric not null default 10000,
  updated_at timestamptz not null default now(),
  constraint settings_singleton check (id = true)
);

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric not null default 0 check (amount >= 0),
  sourced_by text not null default '',
  logo_status text not null default 'Nog niet ontvangen',
  payment_status text not null constraint sponsors_payment_status_type_check check (payment_status in ('Tikkie', 'Clubfactuur', 'Anders')),
  sponsor_keuze text not null constraint sponsors_sponsor_keuze_check check (sponsor_keuze in ('Logo klein', 'Logo groot', 'Platinum', 'Sponsorzin', 'Overig')),
  is_betaald boolean not null default false,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Existing records used payment_status as a paid/unpaid status. Preserve that
-- meaning once during the move to a separate paid checkbox and payment type.
alter table public.sponsors add column if not exists is_betaald boolean not null default false;
update public.sponsors
set
  is_betaald = case when payment_status = 'Nog niet betaald' then false else true end,
  payment_status = case
    when payment_status in ('Nog niet betaald', 'Contant/anders') then 'Anders'
    else payment_status
  end
where payment_status in ('Nog niet betaald', 'Clubfactuur', 'Tikkie', 'Contant/anders');
alter table public.sponsors alter column payment_status drop default;
alter table public.sponsors add column if not exists sponsor_keuze text not null default 'Overig';
alter table public.sponsors alter column sponsor_keuze drop default;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sponsors_payment_status_type_check'
      and conrelid = 'public.sponsors'::regclass
  ) then
    alter table public.sponsors
      add constraint sponsors_payment_status_type_check
      check (payment_status in ('Tikkie', 'Clubfactuur', 'Anders'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sponsors_sponsor_keuze_check'
      and conrelid = 'public.sponsors'::regclass
  ) then
    alter table public.sponsors
      add constraint sponsors_sponsor_keuze_check
      check (sponsor_keuze in ('Logo klein', 'Logo groot', 'Platinum', 'Sponsorzin', 'Overig'));
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('member', 'admin'))
);

create table if not exists public.vriendjes_h1 (
  id uuid primary key default gen_random_uuid(),
  spelersnaam text not null unique,
  aantal_vriendjes integer not null default 0 check (aantal_vriendjes >= 0),
  aantal_jeugdvriendjes integer not null default 0 check (aantal_jeugdvriendjes >= 0)
);

-- Keep one, and only one, registration row available for every H1 player.
insert into public.vriendjes_h1 (spelersnaam)
select speler
from unnest(array[
  'Staf - Algemeen', 'Benning', 'Bo', 'Brackel', 'Gijs', 'Jordy', 'Kasper',
  'Koch', 'Marius', 'Mark', 'Maurits', 'Max', 'Romeo', 'Sebas', 'Tobias', 'Wout'
]::text[]) as speler
on conflict (spelersnaam) do nothing;

insert into public.settings (id) values (true) on conflict (id) do nothing;

alter table public.settings enable row level security;
alter table public.sponsors enable row level security;
alter table public.profiles enable row level security;
alter table public.vriendjes_h1 enable row level security;

create or replace function public.current_role()
returns text language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.protect_sponsor_paid_status()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if (tg_op = 'INSERT' and new.is_betaald)
    or (tg_op = 'UPDATE' and new.is_betaald is distinct from old.is_betaald)
  then
    if public.current_role() is distinct from 'admin' then
      raise exception 'Alleen beheerders kunnen de betaalstatus wijzigen';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_sponsor_paid_status on public.sponsors;
create trigger protect_sponsor_paid_status
before insert or update on public.sponsors
for each row execute function public.protect_sponsor_paid_status();

drop policy if exists "public can read settings" on public.settings;
create policy "public can read settings" on public.settings for select using (true);
drop policy if exists "admins can update settings" on public.settings;
create policy "admins can update settings" on public.settings for update using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

drop policy if exists "members can read sponsors" on public.sponsors;
create policy "members can read sponsors" on public.sponsors for select using (auth.uid() is not null);
drop policy if exists "members can add sponsors" on public.sponsors;
create policy "members can add sponsors" on public.sponsors for insert with check (auth.uid() is not null);
drop policy if exists "members can edit sponsors" on public.sponsors;
create policy "members can edit sponsors" on public.sponsors for update using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "admins can delete sponsors" on public.sponsors;
create policy "admins can delete sponsors" on public.sponsors for delete using (public.current_role() = 'admin');

drop policy if exists "users can read own profile" on public.profiles;
create policy "users can read own profile" on public.profiles for select using (id = auth.uid());

drop policy if exists "admins can read vriendjes h1" on public.vriendjes_h1;
create policy "admins can read vriendjes h1" on public.vriendjes_h1 for select using (public.current_role() = 'admin');
drop policy if exists "admins can add vriendjes h1" on public.vriendjes_h1;
create policy "admins can add vriendjes h1" on public.vriendjes_h1 for insert with check (public.current_role() = 'admin');
drop policy if exists "admins can edit vriendjes h1" on public.vriendjes_h1;
create policy "admins can edit vriendjes h1" on public.vriendjes_h1 for update using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
drop policy if exists "admins can delete vriendjes h1" on public.vriendjes_h1;
create policy "admins can delete vriendjes h1" on public.vriendjes_h1 for delete using (public.current_role() = 'admin');

create or replace view public.public_progress as
select s.goal, s.team, coalesce(sum(sp.amount), 0) as total
from public.settings s left join public.sponsors sp on true group by s.id, s.goal, s.team;

grant select on public.public_progress to anon, authenticated;
grant select on public.settings to anon, authenticated;
grant select, insert, update, delete on public.sponsors to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.vriendjes_h1 to authenticated;
