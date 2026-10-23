-- Watching v0.3.0: Someday, Set Aside and episode synopses.
-- Additive, retains existing placements, episode progress and existing RLS policies.

alter table public.watching_shows
  drop constraint if exists watching_shows_section_check;

alter table public.watching_shows
  add constraint watching_shows_section_check
  check (section in ('watching', 'queued', 'someday', 'set_aside', 'archived'));

alter table public.watching_shows
  add column if not exists set_aside_at timestamptz;

alter table public.watching_episodes
  add column if not exists summary text;

comment on column public.watching_shows.set_aside_at is
  'Watching only. When a show was set aside, without marking its season complete.';
comment on column public.watching_episodes.summary is
  'Watching only. Full available plain-text episode synopsis from TVmaze.';
