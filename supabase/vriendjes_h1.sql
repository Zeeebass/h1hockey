-- Run this once in the Supabase SQL Editor.
-- Assumes public.current_role() already exists in your current schema.

create table if not exists public.vriendjes_h1 (
  id uuid primary key default gen_random_uuid(),
  spelersnaam text not null unique,
  aantal_vriendjes integer not null default 0 check (aantal_vriendjes >= 0),
  aantal_jeugdvriendjes integer not null default 0 check (aantal_jeugdvriendjes >= 0)
);

-- Create exactly one registration row for every H1 player.
insert into public.vriendjes_h1 (spelersnaam)
select speler
from unnest(array[
  'Staf - Algemeen', 'Benning', 'Bo', 'Brackel', 'Gijs', 'Jordy', 'Kasper',
  'Koch', 'Marius', 'Mark', 'Maurits', 'Max', 'Romeo', 'Sebas', 'Tobias', 'Wout'
]::text[]) as speler
on conflict (spelersnaam) do nothing;

alter table public.vriendjes_h1 enable row level security;

drop policy if exists "admins can read vriendjes h1" on public.vriendjes_h1;
create policy "admins can read vriendjes h1"
on public.vriendjes_h1 for select
using (public.current_role() = 'admin');

drop policy if exists "admins can add vriendjes h1" on public.vriendjes_h1;
create policy "admins can add vriendjes h1"
on public.vriendjes_h1 for insert
with check (public.current_role() = 'admin');

drop policy if exists "admins can edit vriendjes h1" on public.vriendjes_h1;
create policy "admins can edit vriendjes h1"
on public.vriendjes_h1 for update
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "admins can delete vriendjes h1" on public.vriendjes_h1;
create policy "admins can delete vriendjes h1"
on public.vriendjes_h1 for delete
using (public.current_role() = 'admin');

grant select, insert, update, delete on public.vriendjes_h1 to authenticated;
