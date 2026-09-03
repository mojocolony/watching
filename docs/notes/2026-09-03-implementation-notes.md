# Watching v0.1.0 — Implementation Notes

These notes record implementation choices that changed after the original implementation plan was written.

## Changes from the initial plan

### Shared Supabase project

The initial plan preferred a dedicated Supabase project. During implementation, William chose to place Watching inside the existing **Ticking** project instead.

Current solution:

- shared project ref: `appesztafatypbxzdunr`
- region: `ca-central-1`
- isolated `watching_*` namespace
- `watching_access` allow-list
- RLS and explicit Data API grants
- no references to Ticking application tables
- shared `auth.users` only

### Browser-native build

The initial plan proposed Vite and npm dependencies. The package registry was unavailable in the build environment, and Watching's requirements did not justify blocking on a toolchain.

The implementation therefore became a browser-native ES-module app with no build step. This keeps the deployed artifact smaller and closer to the project's lightweight intent.

External runtime dependencies are limited to:

- Supabase JS loaded as a pinned browser ESM module from jsDelivr
- Google Fonts for IBM Plex Mono
- TVmaze HTTP API

Lucide icon paths required by the design are embedded locally as SVG markup rather than loading an icon library at runtime.

### Dragging

Rather than SortableJS, v0.1.0 uses a small Pointer Events drag controller with explicit tests for top, middle, bottom, and empty-list drop positions. This avoids another runtime dependency and directly guards against the “cannot drag above the first item” failure mode encountered in another app.

## Live database verification

On September 3, 2026:

- all four Watching tables existed with RLS enabled
- `watching_access` contained one authorized user
- an authenticated simulation for the authorized user could see the allow-list
- a different authenticated identity could see zero Watching rows
- Supabase security advisors reported no Watching-specific RLS warning

## Deployment status

The source and workflow are prepared, but this build environment does not have a GitHub write connector or authenticated GitHub CLI. The repository and GitHub Pages deployment therefore still need to be created/pushed from a GitHub-capable environment.
