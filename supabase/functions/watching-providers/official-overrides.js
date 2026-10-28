// Conservative, season-specific exceptions backed by primary Canadian listings.
// Never infer access to one service from a separately billed Amazon Channel.
// Source: Bell Media, September 2026 Crave Streaming Overview:
// https://www.bellmedia.ca/the-lede/press/september-2026-crave-streaming-overview/
// "September 4 – THE PAPER Season 1" (Additional Highlights).
const verifiedSeasons = Object.freeze([
  { sourceShowId: 84611, title: 'the paper', seasonNumber: 1, provider: 'Crave' },
]);

export function officialSeasonProvider({ title, sourceShowId, seasonNumber } = {}) {
  const norm = String(title ?? '').trim().toLocaleLowerCase('en-CA');
  const record = verifiedSeasons.find(item =>
    item.sourceShowId === Number(sourceShowId)
      && item.seasonNumber === Number(seasonNumber)
      && item.title === norm);
  return record?.provider ?? null;
}
