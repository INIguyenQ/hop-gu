-- Shared places.
--
-- What is shared between users: a place (name, address, pin, links) and the
-- names of the dishes it serves.
-- What stays private to each user: every log (verdict, taste chips, tags,
-- notes) and their wishlist.
--
-- The first version kept everything per user. Those tables were empty when
-- this ran, so they are rebuilt rather than altered.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

drop table if exists public.logs;
drop table if exists public.dishes;
drop table if exists public.places;

-- "Phở Thìn - Lò Đúc" -> "pho thin lo duc", for accent-free search and duplicate checks.
create function public.norm_text(t text) returns text
language sql stable set search_path = '' as $$
  select trim(regexp_replace(
    lower(extensions.unaccent(replace(replace(normalize(coalesce(t, ''), NFC), 'đ', 'd'), 'Đ', 'D'))),
    '[^a-z0-9]+', ' ', 'g'))
$$;

------------------------------------------------------------------ places

create table public.places (
  id uuid primary key,
  -- Kept when the creator deletes their account, so other people's diaries still work.
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  area text not null default '' check (char_length(area) <= 80),
  address text not null default '' check (char_length(address) <= 200),
  kind text not null check (kind in ('shop', 'street')),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  hours_note text check (char_length(hours_note) <= 120),
  listings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(listings) = 'array' and jsonb_array_length(listings) <= 10 and pg_column_size(listings) <= 24000),
  visibility text not null default 'shared' check (visibility in ('shared', 'private')),
  search_text text not null default '',
  created_at timestamptz not null default now()
);

create function public.places_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
      -- A cap per account per day, so one account cannot flood the shared map.
      if (select count(*) from public.places p
          where p.created_by = auth.uid() and p.created_at > now() - interval '1 day') >= 40 then
        raise exception 'place_limit' using errcode = 'P0001';
      end if;
    end if;
    new.created_at := now();
  else
    new.id := old.id;
    -- Ownership can be given up (set to nobody) but never moved to someone else.
    if new.created_by is not null then
      new.created_by := old.created_by;
    end if;
    new.created_at := old.created_at;
    -- Other people may already have logs on a shared place; it cannot be hidden from them.
    if old.visibility = 'shared' and new.visibility = 'private' then
      raise exception 'shared_place_cannot_become_private' using errcode = 'P0001';
    end if;
  end if;
  new.search_text := public.norm_text(new.name || ' ' || new.area || ' ' || new.address);
  return new;
end $$;

create trigger places_before_write before insert or update on public.places
  for each row execute function public.places_before_write();

create index places_search_idx on public.places using gin (search_text extensions.gin_trgm_ops);
create index places_created_by_idx on public.places (created_by);
create index places_lat_lng_idx on public.places (lat, lng);

alter table public.places enable row level security;

create policy "places: read shared or own" on public.places for select to authenticated
  using (visibility = 'shared' or (select auth.uid()) = created_by);
create policy "places: add as yourself" on public.places for insert to authenticated
  with check ((select auth.uid()) = created_by);
create policy "places: creator can correct" on public.places for update to authenticated
  using ((select auth.uid()) = created_by) with check ((select auth.uid()) = created_by);
-- Deleting only succeeds when nobody's logs or wishlist point at the place (see the foreign keys below).
create policy "places: creator can remove" on public.places for delete to authenticated
  using ((select auth.uid()) = created_by);

------------------------------------------------------------------ dishes

create table public.dishes (
  id uuid primary key,
  place_id uuid not null references public.places (id) on delete cascade,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  norm_name text not null default '',
  type_id text check (char_length(type_id) <= 40),
  created_at timestamptz not null default now(),
  -- One entry per dish name per place, however many people log it.
  unique (place_id, norm_name),
  unique (id, place_id)
);

create function public.dishes_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
      if (select count(*) from public.dishes d
          where d.created_by = auth.uid() and d.created_at > now() - interval '1 day') >= 300 then
        raise exception 'dish_limit' using errcode = 'P0001';
      end if;
    end if;
    new.created_at := now();
  else
    new.id := old.id;
    new.place_id := old.place_id;
    if new.created_by is not null then
      new.created_by := old.created_by;
    end if;
    new.created_at := old.created_at;
  end if;
  new.norm_name := coalesce(nullif(public.norm_text(new.name), ''), lower(new.name));
  return new;
end $$;

create trigger dishes_before_write before insert or update on public.dishes
  for each row execute function public.dishes_before_write();

create index dishes_created_by_idx on public.dishes (created_by);

alter table public.dishes enable row level security;

-- A dish is visible exactly when its place is (the places rules apply inside the sub-query).
create policy "dishes: read where place is visible" on public.dishes for select to authenticated
  using (exists (select 1 from public.places p where p.id = place_id));
create policy "dishes: add to a visible place" on public.dishes for insert to authenticated
  with check ((select auth.uid()) = created_by and exists (select 1 from public.places p where p.id = place_id));
create policy "dishes: creator can correct" on public.dishes for update to authenticated
  using ((select auth.uid()) = created_by) with check ((select auth.uid()) = created_by);
create policy "dishes: creator can remove" on public.dishes for delete to authenticated
  using ((select auth.uid()) = created_by);

------------------------------------------------------------------ logs (private)

create table public.logs (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dish_id uuid not null,
  -- "restrict": a place or dish cannot be deleted while anyone's log points at it.
  place_id uuid not null references public.places (id) on delete restrict,
  verdict text not null check (verdict in ('love', 'ok', 'never')),
  chips jsonb not null default '{}'::jsonb
    check (jsonb_typeof(chips) = 'object' and pg_column_size(chips) <= 2000),
  tags text[] not null default '{}' check (cardinality(tags) <= 12),
  note text not null default '' check (char_length(note) <= 1000),
  platform text not null check (platform in ('grab', 'shopeefood', 'befood', 'gmaps', 'dinein', 'other')),
  eaten_on date not null,
  created_at timestamptz not null default now(),
  -- The dish must belong to that place.
  foreign key (dish_id, place_id) references public.dishes (id, place_id) on delete restrict
);

create index logs_user_date_idx on public.logs (user_id, eaten_on desc);
create index logs_dish_idx on public.logs (dish_id, place_id);
create index logs_place_idx on public.logs (place_id);

alter table public.logs enable row level security;

create policy "logs: read own" on public.logs for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "logs: add own, on a visible place" on public.logs for insert to authenticated
  with check ((select auth.uid()) = user_id and exists (select 1 from public.places p where p.id = place_id));
create policy "logs: change own" on public.logs for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "logs: remove own" on public.logs for delete to authenticated
  using ((select auth.uid()) = user_id);

------------------------------------------------------------------ wishlist (private)

create table public.wishlist (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete restrict,
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create index wishlist_place_idx on public.wishlist (place_id);

alter table public.wishlist enable row level security;

create policy "wishlist: read own" on public.wishlist for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "wishlist: add own, on a visible place" on public.wishlist for insert to authenticated
  with check ((select auth.uid()) = user_id and exists (select 1 from public.places p where p.id = place_id));
create policy "wishlist: change own" on public.wishlist for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "wishlist: remove own" on public.wishlist for delete to authenticated
  using ((select auth.uid()) = user_id);

------------------------------------------------------------------ reports

-- Users can flag a shared place. Reports are reviewed in the Supabase dashboard for now.
create table public.place_reports (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  reporter uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text not null check (reason in ('duplicate', 'wrong_info', 'closed', 'abuse')),
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  unique (place_id, reporter, reason)
);

create index place_reports_reporter_idx on public.place_reports (reporter);

alter table public.place_reports enable row level security;

create policy "reports: read own" on public.place_reports for select to authenticated
  using ((select auth.uid()) = reporter);
create policy "reports: add own, on a visible place" on public.place_reports for insert to authenticated
  with check ((select auth.uid()) = reporter and exists (select 1 from public.places p where p.id = place_id));

------------------------------------------------------------------ daily allowances for paid look-ups

-- Counts how often each user has used a costly server feature today.
-- No policies: only the function below can touch it.
create table public.api_quota (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  day date not null default current_date,
  used integer not null default 0,
  primary key (user_id, kind, day)
);

alter table public.api_quota enable row level security;

-- Uses up one unit of today's allowance. Returns false when it is spent.
-- The limits live here, so a caller cannot grant themselves more.
create function public.consume_quota(p_kind text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_limit integer;
  v_used integer;
begin
  if auth.uid() is null then
    return false;
  end if;
  v_limit := case p_kind when 'geocode' then 30 else null end;
  if v_limit is null then
    return false;
  end if;
  insert into public.api_quota as q (user_id, kind, day, used)
    values (auth.uid(), p_kind, current_date, 1)
    on conflict (user_id, kind, day) do update set used = q.used + 1
    returning q.used into v_used;
  return v_used <= v_limit;
end $$;

------------------------------------------------------------------ "delete all my data"

-- Removes the caller's logs and wishlist, deletes their places that nobody
-- else uses, and takes their name off shared places that others still use.
create function public.delete_my_diary() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = 'P0001';
  end if;
  delete from public.logs where user_id = v_user;
  delete from public.wishlist where user_id = v_user;
  delete from public.place_reports where reporter = v_user;
  delete from public.dishes d
    where d.created_by = v_user and not exists (select 1 from public.logs l where l.dish_id = d.id);
  delete from public.places p
    where p.created_by = v_user
      and not exists (select 1 from public.logs l where l.place_id = p.id)
      and not exists (select 1 from public.wishlist w where w.place_id = p.id)
      and not exists (select 1 from public.dishes d where d.place_id = p.id and d.created_by is distinct from v_user);
  update public.dishes set created_by = null where created_by = v_user;
  update public.places set created_by = null where created_by = v_user;
end $$;

------------------------------------------------------------------ who may do what

revoke all on public.places, public.dishes, public.logs, public.wishlist, public.place_reports, public.api_quota from anon, public, authenticated;
grant select, insert, update, delete on public.places, public.dishes, public.logs, public.wishlist to authenticated;
grant select, insert on public.place_reports to authenticated;

revoke execute on function public.norm_text(text), public.consume_quota(text), public.delete_my_diary(),
  public.places_before_write(), public.dishes_before_write() from public, anon;
grant execute on function public.norm_text(text), public.consume_quota(text), public.delete_my_diary() to authenticated;
