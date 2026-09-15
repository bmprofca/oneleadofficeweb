/** Place a fixed dropdown relative to an anchor rect, kept fully on-screen. */
export function placeFixedMenu(anchorRect, {
  menuWidth = 220,
  menuHeight = 280,
  gap = 6,
  prefer = 'auto',
} = {}) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 8;

  const spaceBelow = vh - anchorRect.bottom - gap - margin;
  const spaceAbove = anchorRect.top - gap - margin;

  let openUp = prefer === 'up';
  if (prefer === 'auto') {
    openUp = spaceBelow < Math.min(menuHeight, 220) && spaceAbove > spaceBelow;
  } else if (prefer === 'down') {
    openUp = false;
  }

  const available = openUp ? spaceAbove : spaceBelow;
  const maxHeight = Math.max(
    160,
    Math.min(menuHeight, available > 120 ? available : vh - margin * 2)
  );

  const left = Math.min(
    Math.max(margin, anchorRect.left),
    Math.max(margin, vw - menuWidth - margin)
  );

  let top = openUp
    ? anchorRect.top - gap - maxHeight
    : anchorRect.bottom + gap;

  // Keep the full panel (including footer / Apply) inside the viewport
  top = Math.min(Math.max(margin, top), Math.max(margin, vh - maxHeight - margin));

  return {
    style: {
      position: 'fixed',
      left,
      top,
      width: menuWidth,
      maxHeight,
      overflowY: 'auto',
      zIndex: 10050,
    },
    openUp,
    maxHeight,
  };
}
