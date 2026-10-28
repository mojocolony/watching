// Only directly subscribed Canadian streaming services belong in auto results.
// Do not alias paid Amazon/Apple add-on channels to their parent services.
export const STREAMING_SERVICES = Object.freeze([
  'Netflix', 'Crave', 'Prime', 'Paramount+', 'Disney+', 'AppleTV',
]);

const aliases = new Map([
  ['netflix', 'Netflix'],
  ['netflix standard with ads', 'Netflix'],
  ['crave', 'Crave'],
  ['prime', 'Prime'],
  ['prime video', 'Prime'],
  ['amazon prime video', 'Prime'],
  ['amazon prime video with ads', 'Prime'],
  ['prime video with ads', 'Prime'],
  ['paramount+', 'Paramount+'],
  ['paramount plus', 'Paramount+'],
  ['paramount plus premium', 'Paramount+'],
  ['paramount plus basic with ads', 'Paramount+'],
  ['disney+', 'Disney+'],
  ['disney plus', 'Disney+'],
  ['appletv', 'AppleTV'],
  ['apple tv', 'AppleTV'],
  ['apple tv+', 'AppleTV'],
  ['apple tv plus', 'AppleTV'],
]);

export function subscribedProviderName(name) {
  return aliases.get(String(name ?? '').trim().toLocaleLowerCase('en-CA')) ?? null;
}

export function displayProviderName(name) {
  const original = String(name ?? '').trim();
  return subscribedProviderName(original) ?? original;
}

// Custom/manual sources such as CNN/PVR, Jellyfin and Download remain visible.
// Unknown automatic providers must not appear in Watching's service field.
export function visibleProviderForShow(show) {
  return show?.watchProviderManual
    ? displayProviderName(show.watchProvider)
    : (subscribedProviderName(show?.watchProvider) ?? '');
}
