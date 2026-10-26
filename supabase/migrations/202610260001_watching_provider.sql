-- Watching v0.3.4: per-show Canadian provider or selected source.
-- This migration was applied to the shared Ticking Supabase project on 2026-10-26.
alter table public.watching_shows
  add column if not exists watch_provider text;

alter table public.watching_shows
  add column if not exists watch_provider_manual boolean not null default false;

comment on column public.watching_shows.watch_provider is
  'Canadian streaming service or user-selected source such as Jellyfin';
comment on column public.watching_shows.watch_provider_manual is
  'True when user selection must not be replaced by automatic availability refresh';
