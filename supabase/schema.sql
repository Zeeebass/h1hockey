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
  payment_status text not null default 'Nog niet betaald',
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('member', 'admin'))
);

insert into public.settings (id) values (true) on conflict (id) do nothing;

alter table public.settings enable row level security;
alter table public.sponsors enable row level security;
alter table public.profiles enable row level security;

create or replace function public.current_role()
returns text language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

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

create or replace view public.public_progress as
select s.goal, s.team, coalesce(sum(sp.amount), 0) as total
from public.settings s left join public.sponsors sp on true group by s.id, s.goal, s.team;

grant select on public.public_progress to anon, authenticated;
grant select on public.settings to anon, authenticated;
grant select, insert, update, delete on public.sponsors to authenticated;
grant select on public.profiles to authenticated;
