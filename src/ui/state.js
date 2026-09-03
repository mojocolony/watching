import { toggleEpisodeWatched } from '../domain/shows.js';

const FONT_SCALES = new Set(['small', 'medium', 'large']);
const THEME_MODES = new Set(['system', 'light', 'dark']);

export function reduceState(state, action) {
  switch (action.type) {
    case 'toggle-show':
      return {
        ...state,
        shows: state.shows.map(show => show.id === action.showId ? { ...show, expanded: !show.expanded } : show),
      };
    case 'toggle-episode':
      return {
        ...state,
        shows: state.shows.map(show => show.id === action.showId ? toggleEpisodeWatched(show, action.episodeId) : show),
      };
    case 'toggle-section': {
      const key = action.section === 'watching' ? 'watchingCollapsed' : action.section === 'queued' ? 'queuedCollapsed' : null;
      if (!key) return state;
      return { ...state, preferences: { ...state.preferences, [key]: !state.preferences[key] } };
    }
    case 'toggle-priya-filter':
      return { ...state, preferences: { ...state.preferences, priyaFilter: !state.preferences.priyaFilter } };
    case 'set-font-scale':
      if (!FONT_SCALES.has(action.fontScale)) return state;
      return { ...state, preferences: { ...state.preferences, fontScale: action.fontScale } };
    case 'set-theme-mode':
      return { ...state, preferences: { ...state.preferences, themeMode: THEME_MODES.has(action.themeMode) ? action.themeMode : 'system' } };
    case 'open-menu':
      return { ...state, menuOpen: true, showMenuId: null };
    case 'open-show-menu':
      return { ...state, showMenuId: action.showId, menuOpen: false };
    case 'close-show-menu':
      return { ...state, showMenuId: null };
    case 'close-menu':
      return { ...state, menuOpen: false };
    case 'open-add':
      return { ...state, sheet: 'add', editingShowId: null, menuOpen: false, showMenuId: null };
    case 'open-edit':
      return { ...state, sheet: 'edit', editingShowId: action.showId, menuOpen: false, showMenuId: null };
    case 'close-sheet':
      return { ...state, sheet: null, editingShowId: null };
    case 'open-archive':
      return { ...state, view: 'archive', menuOpen: false, sheet: null, showMenuId: null };
    case 'close-archive':
      return { ...state, view: 'main' };
    case 'set-completion':
      return { ...state, completion: action.completion };
    case 'clear-completion':
      return { ...state, completion: null };
    default:
      return state;
  }
}
