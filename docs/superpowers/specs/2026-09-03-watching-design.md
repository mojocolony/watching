# Watching — Design Specification

Prepared: September 3, 2026

## 1. Purpose

**Watching** is a very lightweight personal TV-progress app.

It is deliberately narrower than TV Board. Its job is only to answer:

- What am I watching now?
- What is queued up next?
- Where am I in the current season?
- Which shows am I watching with Priya?
- What have I completed?

It is not a discovery, ratings, reviews, recommendations, streaming-service, or media-management app.

## 2. Audience and Accounts

- Single user for v1.
- William is the only account holder.
- The “with Priya” state is metadata on a show, not a second account or shared-user system.
- Data syncs across William’s iPhone, iPad, and Macs.
- Authentication should be intentionally simple.
- Avoid email magic links because of PWA handoff problems on iPhone/iPad.
- Preferred v1 authentication: email + password with a persistent session.
- Sign out lives in the hamburger menu.

## 3. Visual Direction

- App name: **Watching**
- App icon: Lucide `tv`
  - https://lucide.dev/icons/tv
- Typeface: **IBM Plex Mono**
- Very little UI chrome.
- Main screen is primarily two stacked lists.
- No posters required for MVP.
- No ratings, reviews, synopses, streaming-provider badges, stats, or discovery surfaces.
- Responsive and PWA-friendly on iPhone, iPad, and desktop browsers.

## 4. Main Screen

### 4.1 Sections

The main screen contains:

1. **NOW WATCHING**
2. **QUEUED UP**

Each section contains manually ordered shows.

Both section headings are collapsible.

- Now Watching: open by default.
- Queued Up: remembers its last collapsed/expanded state.
- Remember section state across launches.

### 4.2 Show Rows

A collapsed show row contains:

- Show title
- Lucide `users` marker when the show is watched with Priya
- Current season number
- Progress summary
- Expand/collapse affordance

Examples:

- `Severance  👥`
- `Season 2 · 7/10`
- `The Lowdown  👥`
- `Season 1 · 8 episodes`

Tapping the show row expands or collapses its episode list.

### 4.3 Episode Rows

Expanded episodes display:

- Episode number
- Episode title
- Runtime

Example:

`3. Who Is Alive? · 53m`

If runtime is unknown, omit it.

Tapping an episode row toggles watched/unwatched.

Watched state:

- No checkbox.
- No check icon.
- No added symbol.
- The episode row simply dims.

Progress updates automatically.

### 4.4 Ordering and Dragging

There are no alphabetical or alternate sort modes.

Shows are manually ordered by drag.

Users can:

- Drag within Now Watching.
- Drag within Queued Up.
- Drag directly between Now Watching and Queued Up.

The drop position determines the final order.

Episode rows are not draggable.

## 5. Floating Action Pill

Bottom-right: one vertical pill with two stacked controls.

Top:
- Lucide `plus`
- https://lucide.dev/icons/plus
- Opens Add Show sheet/modal.

Bottom:
- Lucide `users`
- https://lucide.dev/icons/users
- Toggles a temporary “with Priya” filter.

When the Priya filter is active:

- Only shows marked “with Priya” are shown.
- Tap again to return to all shows.

The Priya marker itself is assigned or changed in Add/Edit Show, not by this filter button.

## 6. Hamburger Menu

Lucide hamburger/menu control.

The menu contains only:

- Archive
- Font size selector
  - `A−`
  - `A`
  - `A+`
- Sign out
- Version number

No sorting controls are needed.

## 7. Add Show Flow

Tapping `+` opens a compact sheet/modal over the current list.

No separate Add Show page.

### 7.1 Hybrid Lookup

Watching uses a hybrid model:

- Search a TV metadata source first.
- Allow fully manual entry when lookup is unavailable or unsuitable.

Recommended metadata source: **TVmaze**.

### 7.2 Fetched Show Flow

1. Tap `+`.
2. Type show title.
3. Matching shows appear.
4. Select a show.
5. Choose season.
6. Episodes populate automatically.
7. Choose:
   - Now Watching
   - Queued Up
8. Optionally mark “with Priya.”
9. Add.

### 7.3 Manual Flow

Provide a small **Add manually** option.

Manual entry should support at minimum:

- Show title
- Season number
- Episode count
- Optional episode titles
- Optional runtimes
- Now Watching / Queued Up
- With Priya

Manual shows remain manual unless explicitly linked to a metadata source later.

## 8. Edit Show

The same sheet/modal pattern should be reused for editing.

Editable values include:

- Show title when manual
- Current season
- Section
- With Priya
- Episode metadata for manual shows

Avoid adding a large settings surface.

## 9. Season Completion

When the final episode in a season is marked watched:

### If another season is available

Show a compact completion prompt:

- **Watch next season**
- **Queue next season**
- **Archive for now**

### If no later season is available

Offer:

- **Archive**

Archive completion should be explicit, not an accidental automatic disappearance while the user is interacting with the last episode.

## 10. Archive

Archive is reached from the hamburger menu.

Archived entries show:

- Show title
- Completed season
- Completion date

Example:

`Slow Horses`
`Season 6 · Finished Sep 3, 2026`

Archived shows retain their source metadata ID if available.

### 10.1 New Season Detection

If a new season later becomes available for an archived show, display a restrained indicator:

`Season 7 available`

Tapping it offers:

- **Watch now**
- **Queue it**

Do not automatically move an archived show back to the active lists.

## 11. Metadata Refresh

Watching should automatically notice newly announced or newly released episodes.

Keep this lightweight.

### Preferred behaviour

- Render saved/synced data immediately on launch.
- Quietly check TVmaze for metadata changes after launch.
- Refresh occasionally while the app remains active.
- No dedicated background server job is required for MVP.

When source metadata changes:

- Add newly announced episodes.
- Add newly released episodes.
- Update placeholder/unknown episode titles when real titles become available.
- Update runtimes when they become available.
- Preserve watched/unwatched state.
- Preserve show order.
- Preserve section.
- Preserve Priya marker.

If TVmaze is unavailable, the app should continue using its stored data.

## 12. Sync and Persistence

Recommended architecture: **Supabase-first with local cache**.

Supabase stores the canonical user data.

The app should cache enough state locally to:

- Open quickly.
- Display the last known list during temporary network failure.
- Avoid a blank startup screen.

A full local-first conflict-resolution system is out of scope for v1 because the app has one user and a very small data model.

## 13. Suggested Data Model

Exact schema can be finalized during implementation.

### `shows`

Suggested fields:

- `id`
- `user_id`
- `source` — `tvmaze` or `manual`
- `source_show_id` — nullable
- `title`
- `section` — `watching`, `queued`, `archived`
- `sort_order`
- `with_priya`
- `current_season`
- `created_at`
- `updated_at`
- `archived_at` — nullable

### `seasons`

Suggested fields:

- `id`
- `show_id`
- `source_season_id` — nullable
- `season_number`
- `episode_count`
- `completed_at` — nullable

### `episodes`

Suggested fields:

- `id`
- `season_id`
- `source_episode_id` — nullable
- `episode_number`
- `title`
- `runtime_minutes` — nullable
- `watched`
- `airdate` — nullable
- `updated_at`

The implementation should keep this schema minimal and combine tables if that produces a simpler, maintainable design without harming sync behaviour.

## 14. Sync Behaviour

- Changes should sync promptly after interaction.
- Reordering must persist across devices.
- Episode watched state must persist across devices.
- Section moves must persist across devices.
- Priya marker must persist across devices.
- Archive date must persist across devices.

For v1, last-write-wins behaviour is acceptable for rare simultaneous edits from two of William’s devices.

## 15. Error Handling

The app should fail quietly where possible.

Examples:

- TVmaze lookup unavailable → show manual-entry option and existing saved data.
- Metadata refresh fails → keep last known metadata.
- Supabase temporarily unavailable → keep cached UI usable and retry when appropriate.
- Runtime/title missing → omit rather than show ugly placeholders.
- A source show disappears or changes ID → preserve the locally stored record rather than deleting it.

## 16. Out of Scope for MVP

Do not add unless specifically requested later:

- Ratings
- Reviews
- Recommendations
- Discover/browse
- Posters
- Trailers
- Streaming-service availability
- Calendars
- Notifications
- Social sharing
- Multiple users
- Shared Priya account
- Comments
- Lists beyond Now Watching / Queued Up / Archive
- Alphabetical sorting
- Alternate sort modes
- Episode dragging
- Watch-time statistics
- Full offline-first conflict resolution

## 17. MVP Success Criteria

Watching v1 is successful if William can:

1. Sign in simply on each device and stay signed in.
2. Add a show through TVmaze or manually.
3. Choose Now Watching or Queued Up.
4. Mark a show as watched with Priya.
5. Expand a show to see numbered episode titles and runtimes.
6. Tap episodes to dim them as watched.
7. See season progress update.
8. Reorder shows by drag.
9. Drag shows between Now Watching and Queued Up.
10. Collapse either section.
11. Filter to Priya shows with the floating Users button.
12. Finish a season and choose what happens next.
13. Archive completed shows with a completion date.
14. See when an archived show gets a new season.
15. Receive newly announced/released episode metadata automatically.
16. See all changes sync across iPhone, iPad, and Mac.
17. Use the app without unnecessary UI chrome.

## 18. Current Design Status

**Approved in conversation:**

- App name Watching
- IBM Plex Mono
- Lucide TV icon
- Now Watching / Queued Up structure
- Collapsible shows
- Collapsible Queued Up section
- Episode number, title, runtime
- Watched episodes dim only
- Manual drag ordering
- Cross-section dragging
- Hybrid metadata/manual entry
- Add Show modal/sheet
- Ask Now Watching / Queued Up when adding
- With Priya marker
- Floating vertical `+` / Users pill
- Users button acts as Priya filter
- Archive
- Completion timestamp
- Next-season completion choices
- New-season indicator in Archive
- Automatic episode metadata refresh
- Multi-device sync
- Single user for v1
- Simple persistent authentication
- Hamburger menu with font sizing, Archive, sign out, version

## 19. Repository Status

No Watching repository, project folder, hosting URL, or Supabase project has been established in this conversation yet.

Those must be selected during implementation rather than guessed.
