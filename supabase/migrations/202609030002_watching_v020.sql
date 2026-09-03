-- Watching v0.2.0: persist the total number of known seasons for compact progress display.
-- Existing rows remain null until TVmaze metadata refreshes them; manual shows may remain null.

alter table public.watching_shows
  add column if not exists total_seasons integer
  check (total_seasons is null or total_seasons > 0);

comment on column public.watching_shows.total_seasons is
  'Watching app only. Highest known numbered season from metadata; null for unknown/manual shows.';
