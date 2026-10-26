# Watching

Watching is a deliberately lightweight personal TV-progress tracker. It keeps three manually ordered lists, **Now Watching**, **Queued Up**, and **Someday**, with collapsible episode lists, watched progress, runtimes, a “with Priya” marker/filter, season completion, and Archive.

Version: **0.3.4**

## What v0.3.4 does

- Manually ordered **Now Watching**, **Queued Up**, and **Someday** sections
- Drag shows within a section or between sections, including into an empty or collapsed Someday list (drop on its heading)
- Collapse either section and individual shows
- Episode number, title, runtime, and expandable full available TVmaze synopsis
- Tap an episode to toggle watched state; watched episode titles, runtimes, and expandable synopsis labels and text all dim
- TVmaze show/season/episode lookup with manual fallback
- Automatic TVmaze metadata refresh for tracked shows
- Detect newly available seasons for archived shows
- **Set Aside** in the hamburger menu, above Archive, for paused shows without marking seasons complete
- Resume a set-aside show with its watched episodes and season progress intact
- Archive at any point; unfinished shows are labelled **Archived**, completed seasons are labelled **Finished**
- Resume unfinished archived shows without losing episode progress
- “With Priya” marker and quick filter
- IBM Plex Mono UI with a larger default typography scale
- Minimal hamburger menu: Set Aside, Archive, font size, System/Light/Dark theme, sign out, version
- Installable PWA
- Compact progress line: `Season 1/4 · Episode 5/8`
- Three-dot show menu for Edit, Priya marker, moving between all three lists, Set Aside, and Archive
- Per-show streaming/source label beside the season/episode count; manual Jellyfin, Download and platform overrides persist across devices
- Optional Canadian TMDB/JustWatch streaming lookup through an authenticated Supabase Edge Function (requires WATCHING_TMDB_TOKEN in Supabase Edge Function secrets)
- Multi-device sync through Supabase, with automatic refresh on PWA foreground/online events and a manual Sync now control
- Persistent read-only warning when cloud sync fails, so cached data cannot silently appear current
- Clear notice when the With Priya filter is active

## Backend: shared Ticking Supabase project

Watching intentionally lives inside the existing **Ticking** Supabase project rather than using another project.

Project reference: `appesztafatypbxzdunr`
Region: `ca-central-1`

Watching is walled off with its own namespace:

- `watching_access`
- `watching_shows`
- `watching_seasons`
- `watching_episodes`

The Watching tables do **not** reference Ticking, Fetch, Podstream, Snippets, or other app tables. The only shared dependency is `auth.users` so the existing account can sign in.

Isolation is enforced by:

1. `watching_*` table names
2. Row Level Security on every Watching table
3. A separate `watching_access` allow-list
4. Browser access revoked from `anon`
5. Explicit grants only to `authenticated`
6. Ownership checks based on `auth.uid()`

As of September 3, 2026 there is one user in `watching_access`.

The public Supabase project URL and publishable key are embedded in `index.html`; this is intentional for a browser client. **Never add a Supabase secret key or service-role key to this repository.**

### Shared-project security note

Supabase's security advisor reported no Watching-specific RLS problems after the schema was applied. The shared project currently has a project-wide warning that leaked-password protection is disabled. That setting affects Auth for every app sharing the project and was not changed as part of Watching.

## Authentication

Watching uses the existing Supabase email identity with **email + password** and persistent sessions.

It does not use magic-link login, so an installed iPhone/iPad PWA does not depend on an email link reopening Safari.

## Metadata

TV metadata comes from the TVmaze API. User state remains canonical in Supabase.

A metadata refresh may update or add:

- episode titles
- full available episode synopses
- runtimes
- air dates
- newly announced episodes
- newly available seasons

It never deliberately changes:

- watched/unwatched state
- manual show order
- Now Watching / Queued Up / Someday / Set Aside placement
- With Priya state

## Provider configuration

Database columns `watch_provider` (nullable text) and `watch_provider_manual` (boolean) were added via the Supabase migration `watching_provider_selection` on October 26, 2026. Keep the migration in source control. Automatic lookups call the authenticated `watching-providers` Supabase Edge Function, which reads `WATCHING_TMDB_TOKEN` as a server-side Edge Function secret. Configure this in Supabase Dashboard → Edge Functions → Secrets. Never put the token in the GitHub Pages browser configuration. TMDB watch-provider information originates with JustWatch and is series-level. Manual overrides do not require the token.

## Run locally

No package install or build step is required.

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173/` for normal cloud mode.

Open `http://localhost:4173/?demo=1` for local demo data without signing in.

## Tests

```bash
node --test
```

The test suite covers domain state, ordering, TVmaze normalization and refresh, repository mapping, authentication UI, PWA configuration, drag drop-index behaviour, completion flow, app markup, shared-project schema isolation, and local preferences/cache.

## Deployment

Intended repository: `mojocolony/watching`

Intended production URL: `https://mojocolony.github.io/watching/`

`.github/workflows/deploy.yml` runs the tests, stages only the static app files, and deploys them through GitHub Pages using the current GitHub Pages actions.

After creating the repository:

1. Push this repository to `main`.
2. In GitHub, open **Settings → Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push to `main` or run the workflow manually.

## Important files

- `index.html` — production config and app entry point
- `src/app.js` — app orchestration
- `src/data/repository.js` — Supabase persistence
- `src/services/tvmaze.js` — TVmaze adapter
- `src/services/metadata-refresh.js` — automatic source refresh/merge
- `src/ui/` — UI rendering and interactions
- `supabase/migrations/202609030001_watching_schema.sql` — base Watching database schema
- `supabase/migrations/202609030002_watching_v020.sql` — v0.2.0 total-season metadata migration
- `supabase/migrations/202610220001_watching_v030.sql` — v0.3.0 new sections, pause date and synopsis migration
- `manifest.webmanifest` / `sw.js` — PWA shell
- `docs/superpowers/specs/2026-09-03-watching-design.md` — approved product design

## Deliberately excluded from v0.3.0

No posters, discovery, ratings, reviews, recommendations, streaming-service tracking, notifications, watch-time statistics, or alternative sort modes.
