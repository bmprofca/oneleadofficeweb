/** Place a fixed dropdown relative to an anchor rect. */
export function placeFixedMenu(anchorRect, {
  menuWidth = 220,
  menuHeight = 280,
  gap = 6,
  prefer = 'auto',
} = {}) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const spaceBelow = vh - anchorRect.bottom;
  const spaceAbove = anchorRect.top;

  let openUp = prefer === 'up';
  if (prefer === 'auto') {
    openUp = spaceBelow < menuHeight + gap && spaceAbove > spaceBelow;
  } else if (prefer === 'down') {
    openUp = false;
  }

  const available = openUp ? spaceAbove - gap - 8 : spaceBelow - gap - 8;
  const maxHeight = Math.max(160, Math.min(menuHeight, available));

  const left = Math.min(
    Math.max(8, anchorRect.left),
    Math.max(8, vw - menuWidth - 8)
  );

  const style = {
    position: 'fixed',
    left,
    width: menuWidth,
    maxHeight,
    zIndex: 10050,
  };

  if (openUp) {
    style.bottom = vh - anchorRect.top + gap;
    style.top = 'auto';
  } else {
    style.top = anchorRect.bottom + gap;
    style.bottom = 'auto';
  }

  return { style, openUp, maxHeight };
}
