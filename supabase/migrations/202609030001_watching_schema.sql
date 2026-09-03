-- Watching v0.1.0 schema inside the shared Ticking Supabase project.
-- Isolation is provided by a watching_* namespace, a dedicated allow-list,
-- explicit Data API grants, and row-level security. The only shared dependency
-- is auth.users for authentication.

create table if not exists public.watching_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
comment on table public.watching_access is
  'Watching app only. Allow-list for access inside the shared Ticking Supabase project.';

create table if not exists public.watching_shows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('tvmaze', 'manual')),
  source_show_id bigint,
  source_updated_at bigint,
  title text not null,
  section text not null check (section in ('watching', 'queued', 'archived')),
  sort_order integer not null default 0,
  with_priya boolean not null default false,
  current_season integer not null check (current_season > 0),
  available_season_number integer,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, source_show_id)
);
comment on table public.watching_shows is 'Watching app only. Top-level tracked shows.';

create table if not exists public.watching_seasons (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.watching_shows(id) on delete cascade,
  source_season_id bigint,
  season_number integer not null check (season_number > 0),
  completed_at timestamptz,
  unique (show_id, season_number)
);
comment on table public.watching_seasons is 'Watching app only. Seasons belonging to watching_shows.';

create table if not exists public.watching_episodes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.watching_seasons(id) on delete cascade,
  source_episode_id bigint,
  episode_number integer not null check (episode_number > 0),
  title text not null,
  runtime_minutes integer check (runtime_minutes is null or runtime_minutes > 0),
  airdate date,
  watched boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (season_id, episode_number)
);
comment on table public.watching_episodes is 'Watching app only. Episode metadata and watched state.';

create index if not exists watching_shows_user_section_order_idx
  on public.watching_shows (user_id, section, sort_order);
create index if not exists watching_seasons_show_id_idx
  on public.watching_seasons (show_id);
create index if not exists watching_episodes_season_id_idx
  on public.watching_episodes (season_id);

alter table public.watching_access enable row level security;
alter table public.watching_shows enable row level security;
alter table public.watching_seasons enable row level security;
alter table public.watching_episodes enable row level security;

revoke all on public.watching_access from anon;
revoke all on public.watching_shows from anon;
revoke all on public.watching_seasons from anon;
revoke all on public.watching_episodes from anon;

grant select on public.watching_access to authenticated;
grant select, insert, update, delete on public.watching_shows to authenticated;
grant select, insert, update, delete on public.watching_seasons to authenticated;
grant select, insert, update, delete on public.watching_episodes to authenticated;

drop policy if exists watching_access_select_self on public.watching_access;
create policy watching_access_select_self on public.watching_access
for select to authenticated
using ((select auth.uid()) = user_id);

-- Shows require both row ownership and membership in Watching's allow-list.
drop policy if exists watching_shows_select_own on public.watching_shows;
create policy watching_shows_select_own on public.watching_shows
for select to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.watching_access wa
    where wa.user_id = (select auth.uid())
  )
);

drop policy if exists watching_shows_insert_own on public.watching_shows;
create policy watching_shows_insert_own on public.watching_shows
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.watching_access wa
    where wa.user_id = (select auth.uid())
  )
);

drop policy if exists watching_shows_update_own on public.watching_shows;
create policy watching_shows_update_own on public.watching_shows
for update to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.watching_access wa
    where wa.user_id = (select auth.uid())
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.watching_access wa
    where wa.user_id = (select auth.uid())
  )
);

drop policy if exists watching_shows_delete_own on public.watching_shows;
create policy watching_shows_delete_own on public.watching_shows
for delete to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.watching_access wa
    where wa.user_id = (select auth.uid())
  )
);

-- Seasons inherit authorization through the parent show. Because the parent
-- query is itself RLS-protected, the Watching allow-list is enforced here too.
drop policy if exists watching_seasons_select_own on public.watching_seasons;
create policy watching_seasons_select_own on public.watching_seasons
for select to authenticated
using (exists (
  select 1 from public.watching_shows s
  where s.id = show_id and s.user_id = (select auth.uid())
));

drop policy if exists watching_seasons_insert_own on public.watching_seasons;
create policy watching_seasons_insert_own on public.watching_seasons
for insert to authenticated
with check (exists (
  select 1 from public.watching_shows s
  where s.id = show_id and s.user_id = (select auth.uid())
));

drop policy if exists watching_seasons_update_own on public.watching_seasons;
create policy watching_seasons_update_own on public.watching_seasons
for update to authenticated
using (exists (
  select 1 from public.watching_shows s
  where s.id = show_id and s.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.watching_shows s
  where s.id = show_id and s.user_id = (select auth.uid())
));

drop policy if exists watching_seasons_delete_own on public.watching_seasons;
create policy watching_seasons_delete_own on public.watching_seasons
for delete to authenticated
using (exists (
  select 1 from public.watching_shows s
  where s.id = show_id and s.user_id = (select auth.uid())
));

-- Episodes inherit authorization through season -> show.
drop policy if exists watching_episodes_select_own on public.watching_episodes;
create policy watching_episodes_select_own on public.watching_episodes
for select to authenticated
using (exists (
  select 1
  from public.watching_seasons se
  join public.watching_shows s on s.id = se.show_id
  where se.id = season_id and s.user_id = (select auth.uid())
));

drop policy if exists watching_episodes_insert_own on public.watching_episodes;
create policy watching_episodes_insert_own on public.watching_episodes
for insert to authenticated
with check (exists (
  select 1
  from public.watching_seasons se
  join public.watching_shows s on s.id = se.show_id
  where se.id = season_id and s.user_id = (select auth.uid())
));

drop policy if exists watching_episodes_update_own on public.watching_episodes;
create policy watching_episodes_update_own on public.watching_episodes
for update to authenticated
using (exists (
  select 1
  from public.watching_seasons se
  join public.watching_shows s on s.id = se.show_id
  where se.id = season_id and s.user_id = (select auth.uid())
))
with check (exists (
  select 1
  from public.watching_seasons se
  join public.watching_shows s on s.id = se.show_id
  where se.id = season_id and s.user_id = (select auth.uid())
));

drop policy if exists watching_episodes_delete_own on public.watching_episodes;
create policy watching_episodes_delete_own on public.watching_episodes
for delete to authenticated
using (exists (
  select 1
  from public.watching_seasons se
  join public.watching_shows s on s.id = se.show_id
  where se.id = season_id and s.user_id = (select auth.uid())
));

-- Do not seed watching_access here. Authorized users are added deliberately
-- per environment so a shared project cannot accidentally grant Watching to
-- every authenticated account.
