export const APP_NAME = 'Watching';
export const APP_VERSION = '0.2.2';
export const GITHUB_PAGES_BASE = '/watching/';

export function getPublicConfig(source = globalThis.WATCHING_CONFIG ?? {}) {
  return {
    supabaseUrl: String(source.supabaseUrl ?? '').trim(),
    supabaseKey: String(source.supabaseKey ?? '').trim(),
    demoMode: source.demoMode === true,
  };
}

export function isCloudConfigured(config = getPublicConfig()) {
  return Boolean(config.supabaseUrl && config.supabaseKey);
}
