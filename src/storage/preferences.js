const PREFS_KEY = 'watching:preferences:v1';
const VALID_SCALES = new Set(['small', 'medium', 'large']);
const VALID_THEMES = new Set(['system', 'light', 'dark']);
const DEFAULTS = Object.freeze({
  fontScale: 'medium',
  watchingCollapsed: false,
  queuedCollapsed: false,
  priyaFilter: false,
  themeMode: 'system',
});

function normalize(value = {}) {
  return {
    fontScale: VALID_SCALES.has(value.fontScale) ? value.fontScale : DEFAULTS.fontScale,
    watchingCollapsed: value.watchingCollapsed === true,
    queuedCollapsed: value.queuedCollapsed === true,
    priyaFilter: value.priyaFilter === true,
    themeMode: VALID_THEMES.has(value.themeMode) ? value.themeMode : DEFAULTS.themeMode,
  };
}

function safeStorage(storage) {
  return storage ?? globalThis.localStorage;
}

export function readPreferences(storage) {
  try {
    const raw = safeStorage(storage)?.getItem(PREFS_KEY);
    return raw ? normalize(JSON.parse(raw)) : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writePreferences(preferences, storage) {
  safeStorage(storage)?.setItem(PREFS_KEY, JSON.stringify(normalize(preferences)));
}

export { DEFAULTS as DEFAULT_PREFERENCES };
