import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiMoreVertical } from 'react-icons/fi';
import { placeFixedMenu } from '../utils/placeMenu';

export default function ActionMenu({ items = [] }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({
    position: 'fixed',
    top: 0,
    left: 0,
    visibility: 'hidden',
  });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const updatePosition = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const measured = menuRef.current?.offsetHeight || items.length * 40 + 16;
    const menuWidth = 200;
    const { style } = placeFixedMenu(rect, {
      menuWidth,
      menuHeight: measured,
      gap: 6,
    });
    const left = Math.min(
      Math.max(8, rect.right - menuWidth),
      window.innerWidth - menuWidth - 8
    );
    setCoords({
      ...style,
      left,
      width: menuWidth,
      visibility: 'visible',
    });
  };

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const menuWidth = 200;
    const estimated = items.length * 40 + 16;
    const { style } = placeFixedMenu(rect, {
      menuWidth,
      menuHeight: estimated,
      gap: 6,
    });
    const left = Math.min(
      Math.max(8, rect.right - menuWidth),
      window.innerWidth - menuWidth - 8
    );
    setCoords({
      ...style,
      left,
      width: menuWidth,
      visibility: 'hidden',
    });
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    updatePosition();
    const frame = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(frame);
  }, [open, items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;

    const onDoc = (e) => {
      if (
        btnRef.current?.contains(e.target) ||
        menuRef.current?.contains(e.target)
      ) {
        return;
      }
      setOpen(false);
    };

    const onScroll = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      updatePosition();
    };

    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`icon-btn action-menu-btn ${open ? 'active' : ''}`}
        aria-label="Actions"
        aria-expanded={open}
        onClick={toggle}
      >
        <FiMoreVertical size={16} />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              className="action-menu-dropdown"
              style={coords}
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className={`action-menu-item ${item.danger ? 'danger' : ''}`}
                  onClick={() => {
                    setOpen(false);
                    item.onClick?.();
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
