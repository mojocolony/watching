# Watching MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Watching v0.1.0, a minimal single-user PWA for tracking manually ordered TV shows in Now Watching and Queued Up, episode progress, Priya-tagged shows, completed seasons, and automatically refreshed TVmaze metadata across devices.

**Architecture:** Use a framework-free Vite application with small ES modules. Supabase is the canonical synchronized store; a local cache provides fast startup and read-only resilience during temporary outages. TVmaze supplies optional show/season/episode metadata, while manual shows remain fully supported. SortableJS handles touch and mouse reordering within and between the two active sections.

**Tech Stack:** Node.js 22.12+; Vite 8.2.2; vanilla JavaScript ES modules; `@supabase/supabase-js` 2.112.4; SortableJS 1.15.7; Lucide 1.40.0; `@fontsource/ibm-plex-mono` 5.3.0; Vitest 4.1.10; jsdom 30.0.1; Supabase Postgres/Auth; TVmaze REST API; GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-03-watching-design.md`

## Global Constraints

- App name: **Watching**.
- Version for first working release: **0.1.0**.
- Font: **IBM Plex Mono** throughout.
- App icon: Lucide `tv`.
- Main sections: **NOW WATCHING** and **QUEUED UP**.
- Shows are manually ordered only; no alphabetical or alternate sort modes.
- Shows can be dragged within a section or directly between the two active sections.
- Shows and the Queued Up section are collapsible; Now Watching is open by default.
- Episode rows show number, title, and runtime when runtime is known.
- Watched episodes dim only; no checkbox or added watched icon.
- Floating bottom-right control is a vertical pill: `plus` above, `users` below.
- `plus` opens Add Show; `users` toggles the Priya filter.
- Add Show uses TVmaze lookup with a manual fallback.
- Adding always asks **Now Watching** or **Queued Up**.
- Authentication is email + password with persistent session; no magic-link login flow.
- Single user only for v1.
- Archive records completion date and surfaces newly available seasons without automatically restoring them.
- Metadata refresh must never overwrite watched state, manual order, section, or Priya state.
- PWA must be usable on iPhone, iPad, and modern Mac browsers.
- No posters, discovery, ratings, reviews, recommendations, streaming-provider data, notifications, or additional list types in v0.1.0.
- Never commit Supabase secret/service-role keys. Browser code uses only the project URL and publishable/anon key.
- Source repository will be named `watching`; intended GitHub Pages URL is `https://mojocolony.github.io/watching/`.
- Until the repository exists, the approved spec and this plan are source artifacts; Task 1 copies both into the repository.

---

## File Structure

Create the project with the following responsibility boundaries:

```text
watching/
├── .github/
│   └── workflows/
│       └── deploy.yml                 # GitHub Pages build/deploy
├── docs/
│   └── superpowers/
│       ├── specs/
│       │   └── 2026-09-03-watching-design.md
│       └── plans/
│           └── 2026-09-03-watching-mvp.md
├── public/
│   ├── icons/
│   │   ├── icon-192.png
│   │   ├── icon-512.png
│   │   └── maskable-512.png
│   ├── manifest.webmanifest
│   └── sw.js                          # Cache app shell only
├── src/
│   ├── app.js                         # Top-level orchestration only
│   ├── main.js                        # Bootstraps font, CSS, SW, app
│   ├── styles.css                     # Shared visual system and responsive CSS
│   ├── config.js                      # Version, app constants, env validation
│   ├── domain/
│   │   ├── shows.js                   # Pure show/episode/progress transforms
│   │   └── ordering.js                # Pure reorder/cross-section transforms
│   ├── storage/
│   │   ├── cache.js                   # Local cached snapshot
│   │   └── preferences.js             # Font size/collapse/filter preferences
│   ├── services/
│   │   ├── supabase.js                # Supabase client factory
│   │   ├── auth.js                    # Password login/logout/session facade
│   │   ├── tvmaze.js                  # TVmaze HTTP adapter
│   │   └── metadata-refresh.js        # Detect/merge changed source metadata
│   ├── data/
│   │   └── repository.js              # All Supabase CRUD/batch persistence
│   └── ui/
│       ├── auth-view.js
│       ├── main-view.js
│       ├── show-section.js
│       ├── show-row.js
│       ├── add-show-sheet.js
│       ├── completion-sheet.js
│       ├── archive-view.js
│       ├── menu.js
│       ├── floating-pill.js
│       └── drag-controller.js
├── supabase/
│   └── migrations/
│       └── 202609030001_watching_schema.sql
├── tests/
│   ├── domain/
│   │   ├── shows.test.js
│   │   └── ordering.test.js
│   ├── storage/
│   │   └── cache.test.js
│   ├── services/
│   │   ├── tvmaze.test.js
│   │   └── metadata-refresh.test.js
│   ├── data/
│   │   └── repository.test.js
│   └── ui/
│       ├── main-view.test.js
│       ├── add-show-sheet.test.js
│       └── archive-view.test.js
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
└── README.md
```

---

### Task 1: Scaffold the repository, build system, tests, and approved docs

**Files:**
- Create: all root scaffold files listed above
- Create: `docs/superpowers/specs/2026-09-03-watching-design.md`
- Create: `docs/superpowers/plans/2026-09-03-watching-mvp.md`
- Create: `src/config.js`
- Create: `tests/config.test.js`

**Interfaces:**
- Produces: `APP_NAME`, `APP_VERSION`, `GITHUB_PAGES_BASE`, `getPublicConfig()` from `src/config.js`
- Produces: npm scripts `dev`, `build`, `preview`, `test`, `test:watch`

- [ ] **Step 1: Create and initialize the repository**

```bash
mkdir watching
cd watching
git init
npm create vite@8.2.2 . -- --template vanilla --no-interactive
```

Expected: Vite vanilla scaffold exists and `package.json` uses ESM.

- [ ] **Step 2: Install pinned runtime and test dependencies**

```bash
npm install @supabase/supabase-js@2.112.4 sortablejs@1.15.7 lucide@1.40.0 @fontsource/ibm-plex-mono@5.3.0
npm install -D vitest@4.1.10 jsdom@30.0.1
```

- [ ] **Step 3: Set scripts and GitHub Pages base**

Use:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Create `vite.config.js`:

```js
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/watching/',
  test: {
    environment: 'jsdom',
    restoreMocks: true,
  },
});
```

- [ ] **Step 4: Write the failing config test**

`tests/config.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { APP_NAME, APP_VERSION, GITHUB_PAGES_BASE } from '../src/config.js';

describe('Watching config', () => {
  it('exposes the fixed app identity', () => {
    expect(APP_NAME).toBe('Watching');
    expect(APP_VERSION).toBe('0.1.0');
    expect(GITHUB_PAGES_BASE).toBe('/watching/');
  });
});
```

- [ ] **Step 5: Run the test and verify failure**

```bash
npm test -- tests/config.test.js
```

Expected: FAIL because `src/config.js` does not exist.

- [ ] **Step 6: Implement minimal config**

`src/config.js`:

```js
export const APP_NAME = 'Watching';
export const APP_VERSION = '0.1.0';
export const GITHUB_PAGES_BASE = '/watching/';

export function getPublicConfig(env = import.meta.env) {
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Watching is missing its Supabase public configuration.');
  }

  return { supabaseUrl, supabaseKey };
}
```

- [ ] **Step 7: Add environment example and ignore local secrets**

`.env.example`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
```

Ensure `.gitignore` includes:

```text
.env
.env.local
dist
```

- [ ] **Step 8: Copy the approved design and this plan into `docs/superpowers/`**

Do not rewrite requirements during copying.

- [ ] **Step 9: Run tests and production build**

```bash
npm test
npm run build
```

Expected: PASS and `dist/` builds successfully.

- [ ] **Step 10: Commit**

```bash
git add .
git commit -m "chore: scaffold Watching app"
```

---

### Task 2: Implement pure show, episode, progress, and ordering logic

**Files:**
- Create: `src/domain/shows.js`
- Create: `src/domain/ordering.js`
- Create: `tests/domain/shows.test.js`
- Create: `tests/domain/ordering.test.js`

**Interfaces:**
- Produces:
  - `getSeasonProgress(show): { watched: number, total: number }`
  - `toggleEpisodeWatched(show, episodeId): show`
  - `isSeasonComplete(show): boolean`
  - `mergeEpisodeMetadata(existing, incoming): episode`
  - `moveShow(shows, showId, targetSection, targetIndex): shows`
  - `normalizeSectionOrder(shows, section): shows`

- [ ] **Step 1: Write failing domain tests**

`tests/domain/shows.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
  getSeasonProgress,
  isSeasonComplete,
  mergeEpisodeMetadata,
  toggleEpisodeWatched,
} from '../../src/domain/shows.js';

const show = {
  id: 'show-1',
  episodes: [
    { id: 'e1', watched: true, title: 'One', runtimeMinutes: 44 },
    { id: 'e2', watched: false, title: 'Two', runtimeMinutes: null },
  ],
};

describe('show domain', () => {
  it('calculates season progress', () => {
    expect(getSeasonProgress(show)).toEqual({ watched: 1, total: 2 });
  });

  it('toggles watched state without mutating the input', () => {
    const next = toggleEpisodeWatched(show, 'e2');
    expect(next.episodes[1].watched).toBe(true);
    expect(show.episodes[1].watched).toBe(false);
  });

  it('detects completion', () => {
    expect(isSeasonComplete(show)).toBe(false);
    expect(isSeasonComplete(toggleEpisodeWatched(show, 'e2'))).toBe(true);
  });

  it('merges source metadata without changing watched state', () => {
    const existing = { id: 'e2', watched: true, title: 'TBA', runtimeMinutes: null };
    const incoming = { id: 'e2', watched: false, title: 'Reckoning', runtimeMinutes: 52 };
    expect(mergeEpisodeMetadata(existing, incoming)).toEqual({
      id: 'e2',
      watched: true,
      title: 'Reckoning',
      runtimeMinutes: 52,
    });
  });
});
```

`tests/domain/ordering.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { moveShow } from '../../src/domain/ordering.js';

const shows = [
  { id: 'a', section: 'watching', sortOrder: 0 },
  { id: 'b', section: 'watching', sortOrder: 1 },
  { id: 'c', section: 'queued', sortOrder: 0 },
];

describe('moveShow', () => {
  it('moves a show within its section', () => {
    const next = moveShow(shows, 'b', 'watching', 0);
    expect(next.filter(s => s.section === 'watching').map(s => s.id)).toEqual(['b', 'a']);
  });

  it('moves a show between sections and normalizes both orders', () => {
    const next = moveShow(shows, 'a', 'queued', 1);
    expect(next.filter(s => s.section === 'watching')).toEqual([
      { id: 'b', section: 'watching', sortOrder: 0 },
    ]);
    expect(next.filter(s => s.section === 'queued').map(s => [s.id, s.sortOrder]))
      .toEqual([['c', 0], ['a', 1]]);
  });
});
```

- [ ] **Step 2: Verify tests fail**

```bash
npm test -- tests/domain
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement the minimal pure functions**

`src/domain/shows.js`:

```js
export function getSeasonProgress(show) {
  const episodes = show.episodes ?? [];
  return {
    watched: episodes.filter(episode => episode.watched).length,
    total: episodes.length,
  };
}

export function toggleEpisodeWatched(show, episodeId) {
  return {
    ...show,
    episodes: (show.episodes ?? []).map(episode =>
      episode.id === episodeId
        ? { ...episode, watched: !episode.watched }
        : episode
    ),
  };
}

export function isSeasonComplete(show) {
  const { watched, total } = getSeasonProgress(show);
  return total > 0 && watched === total;
}

export function mergeEpisodeMetadata(existing, incoming) {
  return {
    ...existing,
    ...incoming,
    watched: existing.watched,
  };
}
```

`src/domain/ordering.js` must:
1. remove the moved show,
2. insert it at the clamped target index,
3. set the target section,
4. renumber `sortOrder` starting at 0 in both affected sections,
5. leave archive entries untouched.

- [ ] **Step 4: Run domain tests**

```bash
npm test -- tests/domain
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain tests/domain
git commit -m "feat: add Watching domain logic"
```

---

### Task 3: Add local cache and UI preferences

**Files:**
- Create: `src/storage/cache.js`
- Create: `src/storage/preferences.js`
- Create: `tests/storage/cache.test.js`

**Interfaces:**
- Produces:
  - `readCachedSnapshot(storage): { shows: [], cachedAt: string } | null`
  - `writeCachedSnapshot(snapshot, storage): void`
  - `readPreferences(storage)`
  - `writePreferences(prefs, storage)`
- Preferences shape:
  - `fontScale: 'small' | 'medium' | 'large'`
  - `queuedCollapsed: boolean`
  - `watchingCollapsed: boolean`
  - `priyaFilter: boolean`

- [ ] **Step 1: Write failing cache tests**

```js
import { describe, expect, it } from 'vitest';
import { readCachedSnapshot, writeCachedSnapshot } from '../../src/storage/cache.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: key => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, value),
    removeItem: key => map.delete(key),
  };
}

describe('Watching cache', () => {
  it('round-trips a cached snapshot', () => {
    const storage = memoryStorage();
    const snapshot = { shows: [{ id: 'a' }], cachedAt: '2026-09-03T12:00:00Z' };
    writeCachedSnapshot(snapshot, storage);
    expect(readCachedSnapshot(storage)).toEqual(snapshot);
  });

  it('returns null for invalid JSON', () => {
    const storage = memoryStorage();
    storage.setItem('watching:snapshot:v1', '{broken');
    expect(readCachedSnapshot(storage)).toBeNull();
  });
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- tests/storage/cache.test.js
```

- [ ] **Step 3: Implement cache and preferences**

Use versioned keys:

```js
const CACHE_KEY = 'watching:snapshot:v1';
const PREFS_KEY = 'watching:preferences:v1';
```

`readPreferences()` defaults:

```js
{
  fontScale: 'medium',
  watchingCollapsed: false,
  queuedCollapsed: false,
  priyaFilter: false,
}
```

Invalid storage values must fall back to defaults rather than throw.

- [ ] **Step 4: Run storage tests**

```bash
npm test -- tests/storage
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/storage tests/storage
git commit -m "feat: add local cache and preferences"
```

---

### Task 4: Create Supabase schema, RLS, authentication, and repository

**Files:**
- Create: `supabase/migrations/202609030001_watching_schema.sql`
- Create: `src/services/supabase.js`
- Create: `src/services/auth.js`
- Create: `src/data/repository.js`
- Create: `tests/data/repository.test.js`

**Interfaces:**
- Auth:
  - `signIn(email, password)`
  - `signOut()`
  - `getCurrentUser()`
  - `onAuthChange(callback)`
- Repository:
  - `loadShows(userId)`
  - `saveEpisodeWatched(episodeId, watched)`
  - `saveShowPlacement(changedShows)`
  - `createFetchedShow(payload)`
  - `createManualShow(payload)`
  - `archiveShow(showId, completedAt)`
  - `restoreArchivedShow(showId, section, seasonPayload)`
  - `mergeFetchedMetadata(showId, seasonPayload)`

- [ ] **Step 1: Write the SQL migration**

Create exactly three domain tables.

```sql
create table public.watching_shows (
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

create table public.watching_seasons (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.watching_shows(id) on delete cascade,
  source_season_id bigint,
  season_number integer not null check (season_number > 0),
  completed_at timestamptz,
  unique (show_id, season_number)
);

create table public.watching_episodes (
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
```

Add indexes for:
- `(user_id, section, sort_order)` on `watching_shows`
- `show_id` on `watching_seasons`
- `season_id` on `watching_episodes`

Enable RLS on all three.

Policies:
- `watching_shows`: `user_id = auth.uid()`
- `watching_seasons`: permit only when its parent show has `user_id = auth.uid()`
- `watching_episodes`: permit only when season → show resolves to `user_id = auth.uid()`

Apply policies to `select`, `insert`, `update`, and `delete`.

- [ ] **Step 2: Create the browser Supabase client**

`src/services/supabase.js`:

```js
import { createClient } from '@supabase/supabase-js';
import { getPublicConfig } from '../config.js';

const { supabaseUrl, supabaseKey } = getPublicConfig();

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
```

`detectSessionInUrl: false` is intentional because v0.1.0 does not use magic-link/OAuth login.

- [ ] **Step 3: Implement password auth facade**

`signIn(email, password)` must call:

```js
supabase.auth.signInWithPassword({ email, password })
```

`getCurrentUser()` must call `supabase.auth.getUser()` and return `data.user`.

Do not add public sign-up UI. Create the single account from the Supabase dashboard or an administrator-controlled setup flow.

- [ ] **Step 4: Write repository tests against a mocked Supabase chain**

Test at minimum:
- `loadShows()` returns nested seasons/episodes ordered by show `sort_order` and episode number.
- `saveEpisodeWatched()` updates only `watched`.
- `saveShowPlacement()` sends only `id`, `section`, `sort_order`, `updated_at`.
- metadata merge never writes a `watched` field for an existing episode.

- [ ] **Step 5: Implement repository**

`loadShows()` must query:

```text
watching_shows
  -> watching_seasons
     -> watching_episodes
```

Then map database snake_case to app camelCase in one place.

Keep Supabase-specific field names out of UI modules.

- [ ] **Step 6: Apply migration to a dedicated Watching Supabase project**

Create a new Supabase project for Watching unless the user deliberately chooses a shared project during execution.

Do not silently place Watching into an existing shared project.

Record in README:
- Supabase project name
- project reference
- region
- whether it is dedicated or shared

Never record secret key values.

- [ ] **Step 7: Verify RLS manually with two auth users**

User A:
- can create/read/update/delete User A rows.
- cannot read User B rows.

User B:
- cannot access User A child seasons or episodes through direct table queries.

- [ ] **Step 8: Run tests**

```bash
npm test -- tests/data
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add supabase src/services/supabase.js src/services/auth.js src/data tests/data
git commit -m "feat: add synced Supabase data layer"
```

---

### Task 5: Build authentication and the minimal main-screen UI

**Files:**
- Create: `src/ui/auth-view.js`
- Create: `src/ui/main-view.js`
- Create: `src/ui/show-section.js`
- Create: `src/ui/show-row.js`
- Create: `src/ui/floating-pill.js`
- Create: `src/ui/menu.js`
- Modify: `src/app.js`
- Modify: `src/main.js`
- Modify: `src/styles.css`
- Create: `tests/ui/main-view.test.js`

**Interfaces:**
- `renderAuthView(root, { onSignIn })`
- `renderMainView(root, state, actions)`
- Main `state` contains:
  - `shows`
  - `preferences`
  - `loading`
  - `offline`
- Actions include:
  - `toggleShowExpanded(showId)`
  - `toggleEpisode(showId, episodeId)`
  - `toggleSection(section)`
  - `togglePriyaFilter()`
  - `openAddShow()`
  - `openArchive()`
  - `openMenu()`

- [ ] **Step 1: Write a failing UI test**

Test that:
- headings render exactly `NOW WATCHING` and `QUEUED UP`
- the floating pill contains Lucide-compatible `plus` and `users` buttons
- a show with `withPriya: true` includes a `users` icon marker
- a watched episode has class `episode-row--watched`
- a runtime of 53 renders as `53m`
- null runtime does not render `null`, `undefined`, or a placeholder

- [ ] **Step 2: Verify failure**

```bash
npm test -- tests/ui/main-view.test.js
```

- [ ] **Step 3: Implement main UI without data writes**

Use semantic `<section>`, `<button>`, and `<ol>`/`<ul>` elements.

Touch targets must be at least approximately 44 CSS px for:
- menu
- floating plus
- floating users
- show expand/collapse rows

Episode rows may use dense typography but must remain comfortably tappable.

- [ ] **Step 4: Apply the visual system**

`src/main.js` imports only required IBM Plex Mono weights:

```js
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles.css';
```

Base CSS:
- body font is IBM Plex Mono
- no decorative cards around every show
- restrained dividers/spacing
- wide desktop layout uses a readable max content width rather than stretching edge-to-edge
- mobile width 320px must not horizontally scroll
- bottom-right floating pill is vertical
- menu is visually quiet
- no poster-image slots

- [ ] **Step 5: Wire startup orchestration**

Startup order in `src/app.js`:

1. render cached snapshot if present,
2. resolve auth user,
3. show login if absent,
4. load canonical Supabase state if authenticated,
5. replace cache,
6. render main view,
7. launch metadata refresh asynchronously.

Do not make metadata refresh block first render.

- [ ] **Step 6: Run UI and full tests**

```bash
npm test
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src tests/ui
git commit -m "feat: add Watching main interface"
```

---

### Task 6: Add episode toggling, progress, and season-completion flow

**Files:**
- Create: `src/ui/completion-sheet.js`
- Modify: `src/app.js`
- Modify: `src/ui/show-row.js`
- Modify: `src/domain/shows.js`
- Extend: `tests/domain/shows.test.js`
- Extend: `tests/ui/main-view.test.js`

**Interfaces:**
- `toggleEpisode(showId, episodeId)` performs optimistic UI update then persists.
- `renderCompletionSheet({ hasNextSeason, onWatchNext, onQueueNext, onArchive, onCancel })`

- [ ] **Step 1: Add failing tests**

Test:
- tapping an unwatched episode dims it.
- tapping it again restores normal state.
- progress changes `3/8` → `4/8`.
- when final episode becomes watched, completion sheet is requested.
- unwatching an episode never opens completion.
- `hasNextSeason: true` renders exactly:
  - `Watch next season`
  - `Queue next season`
  - `Archive for now`
- `hasNextSeason: false` renders only Archive plus cancel/close.

- [ ] **Step 2: Implement optimistic episode update**

Sequence:

```text
old state
→ locally toggle
→ render immediately
→ repository.saveEpisodeWatched()
→ on failure restore old state and show one restrained error line/toast
```

- [ ] **Step 3: Implement completion choices**

`Watch next season`:
- obtain next season metadata
- section = `watching`
- insert at end of Now Watching
- retain previous completed season in database

`Queue next season`:
- same, section = `queued`
- insert at end of Queued Up

`Archive for now`:
- set section = `archived`
- set `archived_at` to current timestamp
- set completed season `completed_at`
- remove from active DOM after persistence succeeds

- [ ] **Step 4: Test and commit**

```bash
npm test
git add src tests
git commit -m "feat: track episode progress and season completion"
```

---

### Task 7: Add drag ordering within and between active sections

**Files:**
- Create: `src/ui/drag-controller.js`
- Modify: `src/app.js`
- Modify: `src/ui/show-section.js`
- Extend: `tests/domain/ordering.test.js`

**Interfaces:**
- `attachDragController({ watchingList, queuedList, onMove })`
- `onMove({ showId, targetSection, targetIndex })`

- [ ] **Step 1: Extend pure reorder tests**

Include:
- moving first → last within one section
- moving last → first
- moving watching → queued at index 0
- moving queued → watching at end
- empty target section
- clamped negative and over-large indexes

- [ ] **Step 2: Implement SortableJS controller**

Both lists use the same group:

```js
group: 'watching-shows'
```

Use:
- touch delay only if testing proves accidental scrolling requires it
- animation around 120–180ms
- `data-show-id` on draggable rows
- drag handle can be the entire show header, but show expand buttons must remain tappable

On end/add:
1. derive target section from container dataset,
2. derive target index,
3. call `onMove`,
4. re-render from state,
5. batch-persist changed show placement.

- [ ] **Step 3: Add accessible non-drag fallback**

Because drag is the primary interaction, provide an edit action in the show sheet:
- section selector: Now Watching / Queued Up
- moving via this control places the show at the end of the chosen section

No separate sort UI is added.

- [ ] **Step 4: Verify touch behaviour manually**

On iPhone/iPad Safari/PWA:
- vertical page scrolling still works
- long press/drag moves a show
- expanded episode rows do not start show drag
- cross-section drop works
- drop line can reach the first and last position
- no flicker in episode watched state during drag

- [ ] **Step 5: Test and commit**

```bash
npm test -- tests/domain/ordering.test.js
git add src tests/domain
git commit -m "feat: add manual show ordering"
```

---

### Task 8: Implement TVmaze search, season lookup, and hybrid Add Show sheet

**Files:**
- Create: `src/services/tvmaze.js`
- Create: `src/ui/add-show-sheet.js`
- Create: `tests/services/tvmaze.test.js`
- Create: `tests/ui/add-show-sheet.test.js`
- Modify: `src/app.js`

**Interfaces:**
- TVmaze:
  - `searchShows(query): Promise<SearchResult[]>`
  - `getShowSeasons(showId): Promise<SeasonSummary[]>`
  - `getSeasonEpisodes(seasonId): Promise<EpisodeMetadata[]>`
  - `getRecentShowUpdates(since): Promise<Record<string, number>>`
- Search result:
  - `{ sourceShowId, title, premieredYear, networkLabel }`
- Season summary:
  - `{ sourceSeasonId, seasonNumber, premiereDate, endDate }`
- Episode metadata:
  - `{ sourceEpisodeId, episodeNumber, title, runtimeMinutes, airdate }`

- [ ] **Step 1: Write failing TVmaze adapter tests with mocked `fetch`**

Verify:
- search uses `/search/shows?q=...`
- seasons uses `/shows/:id/seasons`
- episodes uses `/seasons/:id/episodes`
- runtime `null` stays null
- malformed responses throw `TVMazeError`
- HTML is not copied into title fields
- search is skipped for queries shorter than 2 trimmed characters

- [ ] **Step 2: Implement adapter**

Use base:

```js
const TVMAZE_BASE = 'https://api.tvmaze.com';
```

Never expose TVmaze response objects directly to UI.

Normalize them at the adapter boundary.

- [ ] **Step 3: Write failing Add Show sheet tests**

Fetched flow must visibly support:

```text
Search
→ select show
→ choose season
→ choose Now Watching / Queued Up
→ With Priya toggle
→ Add
```

Also render `Add manually`.

Manual form minimum:
- title
- season number
- episode count
- optional per-episode title/runtime editing
- section
- With Priya

- [ ] **Step 4: Implement debounced search**

Rules:
- debounce 250ms
- cancel/ignore stale responses with an incrementing request token or AbortController
- show a quiet “No matches” state
- if TVmaze errors, retain manual entry option

- [ ] **Step 5: Persist fetched and manual shows**

Fetched:
- save source = `tvmaze`
- source IDs on show/season/episodes
- source update timestamp when known

Manual:
- source = `manual`
- no fake TVmaze IDs
- generate default episode titles as `Episode 1`, `Episode 2`, etc. only when the user supplies a count but no title

- [ ] **Step 6: Run tests and commit**

```bash
npm test -- tests/services/tvmaze.test.js tests/ui/add-show-sheet.test.js
git add src tests
git commit -m "feat: add hybrid TV show entry"
```

---

### Task 9: Implement automatic metadata refresh without overwriting user state

**Files:**
- Create: `src/services/metadata-refresh.js`
- Create: `tests/services/metadata-refresh.test.js`
- Modify: `src/app.js`
- Modify: `src/data/repository.js`

**Interfaces:**
- `refreshTrackedMetadata({ shows, lastCheckedAt, tvmaze, repository, now })`
- Returns:
  - `{ shows, checkedAt, changedShowIds }`

- [ ] **Step 1: Write failing refresh tests**

Cover these exact cases:

1. Newly announced episode is appended.
2. `TBA` title is replaced when TVmaze supplies the real title.
3. missing runtime becomes known runtime.
4. watched state stays unchanged.
5. section stays unchanged.
6. `sortOrder` stays unchanged.
7. `withPriya` stays unchanged.
8. manual show is never sent to TVmaze.
9. archived show with a newly available season gets `availableSeasonNumber`.
10. TVmaze failure returns old data rather than deleting or blanking it.

- [ ] **Step 2: Implement update-window selection**

Based on elapsed time since `lastCheckedAt`:

```text
<= 1 day   → /updates/shows?since=day
<= 7 days  → /updates/shows?since=week
<= 30 days → /updates/shows?since=month
> 30 days or never checked → refresh all tracked TVmaze shows directly
```

Do not call the unfiltered all-show update endpoint after long inactivity.

- [ ] **Step 3: Implement metadata merge**

For changed active show:
- fetch seasons
- identify `currentSeason`
- fetch that season’s episodes
- add missing episodes
- update mutable source metadata only

For changed archived show:
- fetch seasons
- if maximum numbered season > archived/current season, set `availableSeasonNumber` to the first greater available season number
- do not move the show out of archive

Limit direct refresh concurrency to 4 source shows at a time.

- [ ] **Step 4: Schedule refresh in app lifecycle**

Run:
- after canonical Supabase state renders on app open
- on `visibilitychange` when returning after at least 6 hours
- at most once every 6 hours while app stays active

Do not add notifications, cron jobs, Edge Functions, or background server workers in v0.1.0.

- [ ] **Step 5: Test and commit**

```bash
npm test -- tests/services/metadata-refresh.test.js
git add src tests/services
git commit -m "feat: refresh TV metadata automatically"
```

---

### Task 10: Build Archive and new-season restoration

**Files:**
- Create: `src/ui/archive-view.js`
- Create: `tests/ui/archive-view.test.js`
- Modify: `src/app.js`
- Modify: `src/ui/menu.js`

**Interfaces:**
- `renderArchiveView(root, archivedShows, actions)`
- Actions:
  - `restoreAsWatching(showId, seasonNumber)`
  - `restoreAsQueued(showId, seasonNumber)`
  - `closeArchive()`

- [ ] **Step 1: Write failing Archive tests**

Verify:
- completed title renders
- season renders
- completion date renders in locale-friendly form
- source timestamp is stored precisely but UI date is human readable
- new season renders exactly `Season N available`
- tapping availability exposes `Watch now` and `Queue it`
- a normal archived show with no new season shows neither action

- [ ] **Step 2: Implement archive view**

Do not build a separate router.

Archive can replace the main content area while preserving:
- app title/menu
- back/close affordance
- font size

- [ ] **Step 3: Implement restoration**

On `Watch now` / `Queue it`:
1. fetch selected season metadata,
2. create/update that season and episode rows,
3. clear `archived_at`,
4. clear `available_season_number`,
5. place show at end of chosen active section,
6. render main view.

- [ ] **Step 4: Test and commit**

```bash
npm test -- tests/ui/archive-view.test.js
git add src tests/ui
git commit -m "feat: add archive and new-season return"
```

---

### Task 11: Finish Priya filter, collapsible sections, font sizing, and hamburger menu

**Files:**
- Modify: `src/ui/floating-pill.js`
- Modify: `src/ui/show-section.js`
- Modify: `src/ui/menu.js`
- Modify: `src/storage/preferences.js`
- Modify: `src/app.js`
- Extend: `tests/ui/main-view.test.js`

**Interfaces:**
- Priya filter is presentation-only; it must never mutate show data.
- Section collapsed state and font size persist locally.

- [ ] **Step 1: Add failing tests**

Verify:
- Priya filter hides unmarked shows from both sections.
- toggling again restores all shows in original manual order.
- Queued Up collapses as a whole.
- Now Watching collapses when tapped.
- Now Watching defaults open on first use.
- Queued Up restores previous local state.
- A− / A / A+ map to three fixed CSS scale values.
- menu displays version `0.1.0`.
- menu contains Archive and Sign out.
- menu contains no sort setting.

- [ ] **Step 2: Implement fixed font scales**

Use CSS variable:

```css
:root { --watching-font-scale: 1; }
[data-font-scale="small"] { --watching-font-scale: 0.9; }
[data-font-scale="medium"] { --watching-font-scale: 1; }
[data-font-scale="large"] { --watching-font-scale: 1.12; }
```

Scale primary list typography from this variable; do not zoom the entire viewport.

- [ ] **Step 3: Implement Priya-filter active state**

The bottom `users` button gets an active treatment but remains in the same pill.

Do not add a “Priya” section.

- [ ] **Step 4: Test and commit**

```bash
npm test
git add src tests
git commit -m "feat: finish Watching list controls"
```

---

### Task 12: Add PWA shell, icons, offline startup, and safe service-worker caching

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `public/sw.js`
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Create: `public/icons/maskable-512.png`
- Modify: `index.html`
- Modify: `src/main.js`

**Interfaces:**
- Service worker caches same-origin built app shell/assets only.
- Supabase and TVmaze network requests are never stored in the service-worker cache.
- Cached application data continues to come from `src/storage/cache.js`.

- [ ] **Step 1: Create manifest**

Required values:

```json
{
  "name": "Watching",
  "short_name": "Watching",
  "start_url": "/watching/",
  "scope": "/watching/",
  "display": "standalone",
  "icons": [
    {
      "src": "/watching/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/watching/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "/watching/icons/maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

- [ ] **Step 2: Create the app icon from the Lucide TV glyph**

Use the Lucide `tv` geometry as the central mark.

Requirements:
- simple neutral background
- high-contrast TV glyph
- no text
- preserve generous safe area for iOS/maskable crops
- export 192, 512, and maskable 512 PNGs from the same source

Do not substitute a different TV icon set.

- [ ] **Step 3: Implement service worker**

Cache strategy:
- same-origin static assets: cache-first after install
- navigation: network-first with cached `index.html` fallback
- requests whose origin is not `location.origin`: `fetch(event.request)` only
- increment cache name when app shell changes

Do not cache:
- `api.tvmaze.com`
- Supabase REST/Auth responses

- [ ] **Step 4: Register SW only in production**

`src/main.js`:

```js
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}
```

- [ ] **Step 5: Test offline startup manually**

After one successful authenticated load:
1. load app
2. close
3. disable network
4. reopen installed PWA

Expected:
- app shell renders
- cached show state renders
- a quiet offline state is visible if useful
- changes that require persistence are either queued deliberately or blocked with a clear message

For v0.1.0, do **not** create a general offline write queue. Prefer preventing a write when canonical persistence is unavailable rather than creating conflict logic.

- [ ] **Step 6: Commit**

```bash
git add public index.html src/main.js
git commit -m "feat: make Watching installable"
```

---

### Task 13: Add GitHub Pages deployment and production configuration

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md`
- Modify: `package.json`

**Interfaces:**
- Production URL: `https://mojocolony.github.io/watching/`
- GitHub Actions supplies:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`

- [ ] **Step 1: Add Pages workflow**

Use GitHub’s current Pages artifact/deploy actions.

Workflow requirements:
- trigger on push to `main`
- `npm ci`
- `npm test`
- `npm run build`
- upload `dist`
- deploy only if test/build succeeds

- [ ] **Step 2: Configure GitHub repository**

Repository:
- `mojocolony/watching`
- default branch: `main`
- GitHub Pages source: GitHub Actions

Add repository variables/secrets as appropriate:
- public Supabase URL
- public publishable/anon key

Although the publishable key is safe for browser use when RLS is correct, do not put it directly into committed source.

- [ ] **Step 3: Document deployment**

README must include:

```text
npm ci
npm test
npm run build
```

and explain:
- source of truth is `main`
- `dist/` is generated and must not be edited manually
- deployment is automatic after a passing push to `main`
- hard refresh may be needed while testing a changed service worker
- how to inspect displayed version number

- [ ] **Step 4: Deploy and verify**

Check:
- production URL loads
- no 404 for assets under `/watching/`
- login works in browser
- installed iPhone/iPad PWA logs in with email/password without opening Safari for auth
- refresh/reopen remains signed in
- service worker updates to current shell
- Supabase RLS still protects data

- [ ] **Step 5: Commit**

```bash
git add .github README.md package.json
git commit -m "ci: deploy Watching to GitHub Pages"
```

---

### Task 14: Run the full MVP acceptance pass and tag v0.1.0

**Files:**
- Modify only files needed to fix defects found in this acceptance task
- Modify: `README.md` if any verified setup facts changed

**Interfaces:**
- Produces: tested Git tag `v0.1.0`

- [ ] **Step 1: Run automated verification**

```bash
npm ci
npm test
npm run build
```

Expected:
- all tests PASS
- production build PASS
- no unhandled warnings/errors caused by app code

- [ ] **Step 2: Test add flows**

Fetched:
- search TVmaze
- pick show
- choose season
- choose Now Watching
- mark With Priya
- add
- verify episodes + runtimes

Manual:
- add manually
- create season/episodes
- choose Queued Up
- confirm no TVmaze dependency

- [ ] **Step 3: Test core interactions on desktop**

Verify:
- show expand/collapse
- episode dim/undim
- progress count
- Queued Up collapse
- Priya filter
- menu
- font size
- archive
- version number
- manual drag order
- cross-section drag

- [ ] **Step 4: Test on iPhone PWA**

Verify:
- install
- email/password login
- persistent session
- no magic-link/browser handoff
- vertical pill placement
- no horizontal overflow at narrow width
- tap targets usable
- drag does not prevent normal scrolling
- episode taps do not accidentally drag show
- state syncs after changes

- [ ] **Step 5: Test on iPad PWA**

Repeat the iPhone state/sync/drag checks, specifically:
- expanded episode lists
- sheet sizing
- keyboard dismissal in Add Show
- drag to very top and very bottom of a section

- [ ] **Step 6: Test cross-device sync**

On Device A:
1. watch an episode
2. reorder a show
3. move queued → watching
4. set With Priya

On Device B after refresh/sync:
- all four changes appear
- manual order is identical

- [ ] **Step 7: Test season completion**

For a show with a later season:
- mark final episode watched
- verify 3 choices
- test Queue next season

For a show without later season:
- archive
- verify completion date

- [ ] **Step 8: Test metadata refresh with controlled fixture or source show**

Verify:
- new source episode can be merged
- watched state survives
- title/runtime changes survive
- archive new-season indicator appears
- archive does not automatically move to active list

- [ ] **Step 9: Verify no scope creep**

Main UI must not contain:
- posters
- ratings
- reviews
- recommendations
- streaming services
- sort controls
- notifications
- extra list categories

- [ ] **Step 10: Tag release only after all verification passes**

```bash
git status
git tag -a v0.1.0 -m "Watching v0.1.0"
git push origin main --tags
```

Expected: clean working tree and production deployment from the tested commit.

---

## Implementation Notes

### TVmaze usage

Use these endpoints only:

```text
GET /search/shows?q=:query
GET /shows/:id/seasons
GET /seasons/:id/episodes
GET /updates/shows?since=day|week|month
```

TVmaze is optional enrichment, not the canonical keeper of user progress.

### Supabase session behaviour

Browser client must use:

```js
{
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
}
```

The persistent browser session is what avoids repeated login in the installed PWA. The app does not need a magic-link callback route.

### Date handling

Store:
- archive/completion timestamps as `timestamptz`
- episode air dates as Postgres `date`

For completion display, format `archivedAt` in the user’s local timezone.

Do not convert an episode `airdate` through a UTC midnight `Date` if that could shift its calendar day.

### Optimistic writes

Use optimistic UI only where rollback is simple:
- episode watched toggle
- collapse/filter/font preferences (local only)

For:
- archive
- restore next season
- Add Show

wait for canonical persistence before removing/replacing large UI sections.

### Sync conflicts

v0.1.0 is single-user and may be open on more than one personal device.

Use last-write-wins semantics.

Do not build CRDTs, vector clocks, custom reconciliation, or realtime presence.

Supabase Realtime is not required for v0.1.0. Refresh/reload and ordinary write completion are sufficient unless execution testing demonstrates a concrete need.

---

## Self-Review Results

### Spec coverage

Covered:
- app identity and typography
- two active sections
- collapsible shows and Queued Up
- episode number/title/runtime
- dim-only watched state
- manual ordering
- cross-section dragging
- hybrid TVmaze/manual Add Show
- explicit section choice while adding
- Priya marker and Priya filter
- hamburger menu
- font sizing
- archive and completion timestamp
- next-season completion flow
- archived new-season indicator
- automatic metadata refresh
- Supabase sync
- password/persistent-session auth
- local startup cache
- PWA installability
- GitHub Pages deployment
- mobile/desktop verification
- explicit MVP exclusions

### Intentional implementation decisions

The approved design left these operational facts unset; this plan fixes them for execution:

- Repository: `mojocolony/watching`
- Production URL: `https://mojocolony.github.io/watching/`
- Frontend: Vite + vanilla JavaScript, no React/Vue
- PWA: hand-written service worker
- Drag library: SortableJS
- Supabase Realtime: not required for v0.1.0
- Local cache: read/startup resilience only, not a full offline write queue
- Dedicated Supabase project preferred; do not silently reuse another app’s project
