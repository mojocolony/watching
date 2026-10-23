export function getDropIndex(rows, pointerY) {
  for (let i = 0; i < rows.length; i += 1) {
    const midpoint = rows[i].top + (rows[i].bottom - rows[i].top) / 2;
    if (pointerY < midpoint) return i;
  }
  return rows.length;
}

// Resolve a destination from the full section, not just its show list.
// Empty lists have no usable height, while collapsed sections have no list at all.
export function findDropSection(sections, hitElement, pointerY) {
  const direct = hitElement?.closest?.('.watch-section');
  if (direct && sections.includes(direct)) return direct;
  return sections.reduce((best, section) => {
    const rect = section.getBoundingClientRect();
    const distance = pointerY < rect.top ? rect.top - pointerY : pointerY > rect.bottom ? pointerY - rect.bottom : 0;
    return !best || distance < best.distance ? { section, distance } : best;
  }, null)?.section ?? null;
}

export function attachDragController(root, onMove) {
  let pending = null;
  let active = null;
  let holdTimer = null;
  let marker = null;
  let highlightedSection = null;

  const clearHold = () => {
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = null;
  };

  const cleanup = () => {
    clearHold();
    pending = null;
    if (active?.row) active.row.classList.remove('show-row--dragging');
    active = null;
    marker?.remove();
    marker = null;
    highlightedSection?.classList.remove('watch-section--drop-target');
    highlightedSection = null;
    document.body.classList.remove('dragging-show');
  };

  const beginDrag = event => {
    if (!pending) return;
    const { row, showId, pointerId } = pending;
    active = { row, showId, pointerId, targetSection: row.dataset.section, targetIndex: 0 };
    row.classList.add('show-row--dragging');
    document.body.classList.add('dragging-show');
    try { row.setPointerCapture(pointerId); } catch {}
    updateTarget(event.clientX, event.clientY);
  };

  const updateTarget = (x, y) => {
    if (!active) return;
    const element = document.elementFromPoint(x, y);
    const sections = [...root.querySelectorAll('.watch-section')];
    const destination = findDropSection(sections, element, y);
    if (!destination) return;
    const section = destination.dataset.section;
    if (!['watching', 'queued', 'someday'].includes(section)) return;
    const list = destination.querySelector('.show-list');
    const rows = list ? [...list.querySelectorAll('.show-row:not(.show-row--dragging)')] : [];
    const index = getDropIndex(rows.map(row => row.getBoundingClientRect()), y);
    active.targetSection = section;
    active.targetIndex = index;
    if (highlightedSection !== destination) {
      highlightedSection?.classList.remove('watch-section--drop-target');
      highlightedSection = destination;
      highlightedSection.classList.add('watch-section--drop-target');
    }
    placeMarker(list ?? destination, rows, index);
  };

  const placeMarker = (list, rows, index) => {
    marker ??= Object.assign(document.createElement('div'), { className: 'drop-marker' });
    if (index >= rows.length) list.append(marker);
    else list.insertBefore(marker, rows[index]);
  };

  const onPointerDown = event => {
    if (event.button != null && event.button !== 0) return;
    const toggle = event.target.closest('.show-toggle');
    if (!toggle || event.target.closest('.episode-button')) return;
    const row = toggle.closest('.show-row');
    if (!row) return;
    pending = {
      row,
      showId: row.dataset.showId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      pointerType: event.pointerType,
    };
    clearHold();
    if (event.pointerType !== 'mouse') {
      holdTimer = setTimeout(() => beginDrag(event), 340);
    }
  };

  const onPointerMove = event => {
    if (active) {
      if (event.pointerId !== active.pointerId) return;
      event.preventDefault();
      updateTarget(event.clientX, event.clientY);
      return;
    }
    if (!pending || event.pointerId !== pending.pointerId) return;
    const dx = event.clientX - pending.startX;
    const dy = event.clientY - pending.startY;
    const distance = Math.hypot(dx, dy);
    if (pending.pointerType === 'mouse' && distance > 4) {
      clearHold();
      beginDrag(event);
      return;
    }
    if (distance > 9) {
      clearHold();
      pending = null;
    }
  };

  const onPointerUp = event => {
    if (active && event.pointerId === active.pointerId) {
      event.preventDefault();
      event.stopPropagation();
      const result = {
        showId: active.showId,
        targetSection: active.targetSection,
        targetIndex: active.targetIndex,
      };
      root.dataset.suppressShowClick = '1';
      setTimeout(() => { delete root.dataset.suppressShowClick; }, 80);
      cleanup();
      onMove(result);
      return;
    }
    clearHold();
    pending = null;
  };

  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove, { passive: false });
  root.addEventListener('pointerup', onPointerUp);
  root.addEventListener('pointercancel', cleanup);

  return () => {
    cleanup();
    root.removeEventListener('pointerdown', onPointerDown);
    root.removeEventListener('pointermove', onPointerMove);
    root.removeEventListener('pointerup', onPointerUp);
    root.removeEventListener('pointercancel', cleanup);
  };
}
