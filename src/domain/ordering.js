const ACTIVE_SECTIONS = new Set(['watching', 'queued']);

export function normalizeSectionOrder(shows, section) {
  if (!ACTIVE_SECTIONS.has(section)) return shows.map(show => ({ ...show }));
  const sorted = shows
    .filter(show => show.section === section)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((show, sortOrder) => ({ ...show, sortOrder }));
  const byId = new Map(sorted.map(show => [show.id, show]));
  return shows.map(show => byId.get(show.id) ?? { ...show });
}

export function moveShow(shows, showId, targetSection, targetIndex) {
  if (!ACTIVE_SECTIONS.has(targetSection)) return shows.map(show => ({ ...show }));
  const moved = shows.find(show => show.id === showId);
  if (!moved || !ACTIVE_SECTIONS.has(moved.section)) return shows.map(show => ({ ...show }));

  const sourceSection = moved.section;
  const remaining = shows.filter(show => show.id !== showId).map(show => ({ ...show }));
  const targetItems = remaining
    .filter(show => show.section === targetSection)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const index = Math.max(0, Math.min(Number.isFinite(targetIndex) ? targetIndex : targetItems.length, targetItems.length));
  targetItems.splice(index, 0, { ...moved, section: targetSection });

  const targetMap = new Map(targetItems.map((show, sortOrder) => [show.id, { ...show, sortOrder }]));
  let next = remaining.map(show => targetMap.get(show.id) ?? show);
  if (!targetMap.has(moved.id)) next.push({ ...moved, section: targetSection, sortOrder: index });
  else next.push(targetMap.get(moved.id));

  if (sourceSection !== targetSection) {
    next = normalizeSectionOrder(next, sourceSection);
  }
  next = normalizeSectionOrder(next, targetSection);

  const watching = next.filter(show => show.section === 'watching').sort((a, b) => a.sortOrder - b.sortOrder);
  const queued = next.filter(show => show.section === 'queued').sort((a, b) => a.sortOrder - b.sortOrder);
  const archived = shows.filter(show => show.section === 'archived').map(show => ({ ...show }));
  return [...watching, ...queued, ...archived];
}
