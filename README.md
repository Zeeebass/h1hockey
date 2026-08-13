# Houten Heren 1 sponsor-dashboard

De site is een statische React-app voor Neocities met Supabase als live database. Neocities host alleen de frontend; sponsorregels en instellingen worden direct online opgeslagen.

## Supabase eenmalig instellen

1. Maak een project aan op [supabase.com](https://supabase.com).
2. Open **SQL Editor** en voer de volledige inhoud van `supabase/schema.sql` uit.
3. Maak onder **Authentication → Users** twee gebruikers aan:
   - `hockeylid@houtenheren1.local`
   - `admin@houtenheren1.local`
4. Geef beide gebruikers een eigen wachtwoord. Zet email confirmation uit als Supabase daarom vraagt.
5. Kopieer de user-id’s uit Authentication en voer daarna uit:

```sql
insert into public.profiles (id, role) values
  ('acdb2b37-5232-496e-b36e-43b29fa9e797', 'member'),
  ('5662c7cd-839d-41ca-aa20-411220200820', 'admin');
```

6. Kopieer `.env.example` naar `.env.local`.
7. Vul `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` en dezelfde twee e-mailadressen in.

## Lokaal starten

```powershell
npm.cmd install
npm.cmd run dev
```

## Publiceren op Neocities

```powershell
npm.cmd run build
```

Upload daarna de inhoud van `dist/` naar Neocities. Daarna worden nieuwe sponsors en instellingen direct in Supabase opgeslagen; er is geen nieuwe upload nodig.

## Rollen

- Publiek: alleen doel, totaal en voortgang.
- `member`: sponsors bekijken, toevoegen en bewerken.
- `admin`: member-rechten plus verwijderen en doelbedrag aanpassen.

De anon-key mag in een statische frontend staan. De databasebeveiliging wordt afgedwongen door Row Level Security in `supabase/schema.sql`.
