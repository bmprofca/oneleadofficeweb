import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiChevronDown, FiClock } from 'react-icons/fi';
import { placeFixedMenu } from '../../utils/placeMenu';
import { dayLabel, istDateKeyOffset, istWeekday, toApiDateTime } from './time';

const MENU_WIDTH = 220;

function snoozeOptions() {
  const wd = istWeekday();
  const toMonday = (8 - wd) % 7 || 7;
  const tomorrow = istDateKeyOffset(1);
  const nextWeek = istDateKeyOffset(toMonday);
  return [
    { key: '15m', label: '15 minutes', payload: { minutes: 15 } },
    { key: '1h', label: '1 hour', payload: { minutes: 60 } },
    { key: '3h', label: '3 hours', payload: { minutes: 180 } },
    { key: 'tomorrow', label: 'Tomorrow, 10 AM', payload: { until: toApiDateTime(tomorrow) } },
    { key: 'week', label: 'Next week', hint: `${dayLabel(nextWeek)}, 10 AM`, payload: { until: toApiDateTime(nextWeek) } },
  ];
}

/** "Snooze ▾" button with quick presets. Calls onSnooze(payload, label). */
export default function SnoozeMenu({ onSnooze, disabled }) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState({ position: 'fixed', top: 0, left: 0, visibility: 'hidden' });
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [options, setOptions] = useState([]);

  const place = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const height = menuRef.current?.offsetHeight || 230;
    const { style: s } = placeFixedMenu(rect, { menuWidth: MENU_WIDTH, menuHeight: height, gap: 6 });
    const left = Math.min(Math.max(8, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8);
    setStyle({ ...s, left, visibility: 'visible' });
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    place();
    const frame = requestAnimationFrame(place);
    return () => cancelAnimationFrame(frame);
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const onScroll = (e) => {
      if (!menuRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  const toggle = () => {
    if (!open) setOptions(snoozeOptions());
    setOpen((v) => !v);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`btn small md-snooze-btn${open ? ' is-open' : ''}`}
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <FiClock size={13} />
        <span>Snooze</span>
        <FiChevronDown size={13} className="md-snooze-chevron" />
      </button>
      {createPortal(
        <AnimatePresence>
          {open ? (
            <motion.div
              ref={menuRef}
              role="menu"
              className="action-menu-dropdown md-snooze-menu"
              style={style}
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
            >
              <div className="md-snooze-title">Snooze until…</div>
              {options.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  role="menuitem"
                  className="action-menu-item"
                  onClick={() => {
                    setOpen(false);
                    onSnooze(opt.payload, opt.label);
                  }}
                >
                  <span>{opt.label}</span>
                  {opt.hint ? <small className="md-snooze-hint">{opt.hint}</small> : null}
                </button>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
