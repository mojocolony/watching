// Optional TMDB-powered Canadian streaming availability.
// Requires a TMDB v3 API key or v4 read token in WATCHING_CONFIG.tmdbToken.
// Never infer local-library availability from commercial watch providers.
const API = 'https://api.themoviedb.org/3';
async function request(path, token, fetchImpl) {
  const headers = { Accept: 'application/json' };
  const key = String(token || '').trim();
  const url = new URL(API + path);
  if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key;
  else url.searchParams.set('api_key', key);
  const response = await fetchImpl(url, { headers });
  if (!response.ok) throw new Error('TMDB HTTP ' + response.status);
  return response.json();
}
export async function findCanadianStreamingProvider(title, token, fetchImpl = fetch) {
  if (!String(title).trim() || !String(token).trim()) return null;
  const search = await request('/search/tv?query=' + encodeURIComponent(title), token, fetchImpl);
  const norm = value => String(value || '').trim().toLocaleLowerCase('en-CA');
  const match = (search.results || []).find(item => norm(item.name) === norm(title));
  // Do not match a merely similar title, as that could attach the wrong provider.
  if (!match) return null;
  const availability = await request('/tv/' + encodeURIComponent(match.id) + '/watch/providers', token, fetchImpl);
  const flatrate = availability?.results?.CA?.flatrate || [];
  // When multiple services carry the series, use the provider's canonical TMDB order.
  const first = flatrate.slice().sort((a,b) => (a.display_priority ?? 999) - (b.display_priority ?? 999))[0];
  return first?.provider_name || null;
}
