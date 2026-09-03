export function getDropIndex(rows, pointerY) {
  for (let i = 0; i < rows.length; i += 1) {
    const midpoint = rows[i].top + (rows[i].bottom - rows[i].top) / 2;
    if (pointerY < midpoint) return i;
  }
  return rows.length;
}

export function attachDragController(root, onMove) {
  let pending = null;
  let active = null;
  let holdTimer = null;
  let marker = null;

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
    const list = element?.closest?.('.show-list') ?? findNearestList(y);
    if (!list) return;
    const section = list.dataset.dropSection;
    if (!section) return;
    const rows = [...list.querySelectorAll('.show-row:not(.show-row--dragging)')];
    const boxes = rows.map(row => row.getBoundingClientRect());
    const index = getDropIndex(boxes, y);
    active.targetSection = section;
    active.targetIndex = index;
    placeMarker(list, rows, index);
  };

  const findNearestList = y => {
    const lists = [...root.querySelectorAll('.show-list')];
    if (!lists.length) return null;
    return lists.reduce((best, list) => {
      const rect = list.getBoundingClientRect();
      const distance = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
      return !best || distance < best.distance ? { list, distance } : best;
    }, null)?.list ?? null;
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
