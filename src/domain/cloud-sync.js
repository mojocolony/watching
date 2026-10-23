// Device-local UI state may survive a refresh, but show membership and progress
// always come from the latest successful server response.
export function reconcileCloudShows(previousShows, cloudShows) {
  const expandedById = new Map((previousShows ?? []).map(show => [show.id, show.expanded === true]));
  return (cloudShows ?? []).map(show => ({
    ...show,
    expanded: expandedById.get(show.id) === true,
  }));
}
