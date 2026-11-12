-- Personal dish diary: every row belongs to exactly one signed-in user.
-- Row Level Security is on for every table, so the database itself refuses
-- to show or change another user's rows, whatever the app code does.

create table public.places (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  area text not null default '' check (char_length(area) <= 80),
  kind text not null check (kind in ('shop', 'street')),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  hours_note text check (char_length(hours_note) <= 120),
  listings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(listings) = 'array' and jsonb_array_length(listings) <= 10 and pg_column_size(listings) <= 24000),
  wishlist boolean not null default false,
  wish_note text check (char_length(wish_note) <= 300),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.dishes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  place_id uuid not null,
  name text not null check (char_length(name) between 1 and 120),
  type_id text check (char_length(type_id) <= 40),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  -- A dish can only hang off a place owned by the same user.
  foreign key (place_id, user_id) references public.places (id, user_id) on delete cascade
);

create table public.logs (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dish_id uuid not null,
  place_id uuid not null,
  verdict text not null check (verdict in ('love', 'ok', 'never')),
  chips jsonb not null default '{}'::jsonb
    check (jsonb_typeof(chips) = 'object' and pg_column_size(chips) <= 2000),
  tags text[] not null default '{}' check (cardinality(tags) <= 12),
  note text not null default '' check (char_length(note) <= 1000),
  platform text not null check (platform in ('grab', 'shopeefood', 'befood', 'gmaps', 'dinein', 'other')),
  eaten_on date not null,
  created_at timestamptz not null default now(),
  foreign key (dish_id, user_id) references public.dishes (id, user_id) on delete cascade,
  foreign key (place_id, user_id) references public.places (id, user_id) on delete cascade
);

create index places_user_idx on public.places (user_id);
create index dishes_user_idx on public.dishes (user_id);
create index dishes_place_idx on public.dishes (place_id, user_id);
create index logs_user_date_idx on public.logs (user_id, eaten_on desc);
create index logs_dish_idx on public.logs (dish_id, user_id);
create index logs_place_idx on public.logs (place_id, user_id);

alter table public.places enable row level security;
alter table public.dishes enable row level security;
alter table public.logs enable row level security;

-- Visitors who are not signed in get nothing at all.
revoke all on public.places, public.dishes, public.logs from anon, public;
grant select, insert, update, delete on public.places, public.dishes, public.logs to authenticated;

create policy "own places: read" on public.places for select to authenticated using ((select auth.uid()) = user_id);
create policy "own places: add" on public.places for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own places: change" on public.places for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own places: remove" on public.places for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own dishes: read" on public.dishes for select to authenticated using ((select auth.uid()) = user_id);
create policy "own dishes: add" on public.dishes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own dishes: change" on public.dishes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own dishes: remove" on public.dishes for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own logs: read" on public.logs for select to authenticated using ((select auth.uid()) = user_id);
create policy "own logs: add" on public.logs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own logs: change" on public.logs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own logs: remove" on public.logs for delete to authenticated using ((select auth.uid()) = user_id);
