import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiCheck, FiChevronDown, FiLoader, FiSearch, FiX } from 'react-icons/fi';
import { placeFixedMenu } from '../utils/placeMenu';

function normalizeOptions(list = []) {
  return list
    .map((item) => {
      if (item == null) return null;
      if (typeof item === 'string' || typeof item === 'number') {
        return { value: String(item), label: String(item) };
      }
      return {
        value: String(item.value),
        label: item.label ?? String(item.value),
        meta: item.meta,
      };
    })
    .filter(Boolean);
}

function toValueArray(value, multiple) {
  if (multiple) {
    if (Array.isArray(value)) return value.map(String);
    if (value === '' || value == null) return [];
    return [String(value)];
  }
  return value === '' || value == null ? [] : [String(value)];
}

export default function SearchableSelect({
  value = '',
  onChange,
  options,
  loadOptions,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  clearable = true,
  disabled = false,
  required = false,
  valueLabel,
  valueLabels,
  className = '',
  pageSize = 20,
  multiple = false,
  invalid = false,
}) {
  const id = useId();
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const listRef = useRef(null);
  const searchInputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [asyncItems, setAsyncItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [menuStyle, setMenuStyle] = useState({
    position: 'fixed',
    top: 0,
    left: 0,
    width: 220,
    visibility: 'hidden',
  });
  const searchTimer = useRef(null);
  const requestId = useRef(0);
  const loadingMoreRef = useRef(false);
  const selectedMapRef = useRef(new Map());

  const selectedValues = useMemo(
    () => toValueArray(value, multiple),
    [value, multiple]
  );

  const staticOptions = useMemo(
    () => (loadOptions ? [] : normalizeOptions(options)),
    [options, loadOptions]
  );

  const filteredStatic = useMemo(() => {
    if (loadOptions) return [];
    const q = query.trim().toLowerCase();
    if (!q) return staticOptions;
    return staticOptions.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        String(o.value).toLowerCase().includes(q)
    );
  }, [staticOptions, query, loadOptions]);

  const displayOptions = loadOptions ? asyncItems : filteredStatic;

  useEffect(() => {
    if (Array.isArray(valueLabels)) {
      valueLabels.forEach((item) => {
        if (item?.value != null) {
          selectedMapRef.current.set(String(item.value), item.label || String(item.value));
        }
      });
    }
    if (valueLabel && !multiple && selectedValues[0]) {
      selectedMapRef.current.set(selectedValues[0], valueLabel);
    }
  }, [valueLabel, valueLabels, selectedValues, multiple]);

  const resolveLabel = useCallback(
    (val) => {
      const key = String(val);
      if (
        !multiple &&
        valueLabel &&
        selectedValues[0] &&
        key === String(selectedValues[0])
      ) {
        return valueLabel;
      }
      const cached = selectedMapRef.current.get(key);
      if (cached) return cached;
      const fromAsync = asyncItems.find((o) => String(o.value) === key);
      if (fromAsync) return fromAsync.label;
      const fromStatic = staticOptions.find((o) => String(o.value) === key);
      if (fromStatic) return fromStatic.label;
      return key;
    },
    [asyncItems, staticOptions, multiple, valueLabel, selectedValues]
  );

  const selectedLabel = useMemo(() => {
    if (!selectedValues.length) return '';
    if (multiple) {
      if (selectedValues.length === 1) return resolveLabel(selectedValues[0]);
      return `${selectedValues.length} selected`;
    }
    return resolveLabel(selectedValues[0]);
  }, [selectedValues, multiple, resolveLabel]);

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const measured = menuRef.current?.offsetHeight || 320;
    const width = Math.max(rect.width, 220);
    const { style } = placeFixedMenu(rect, {
      menuWidth: width,
      menuHeight: Math.max(measured, 280),
      gap: 6,
    });
    setMenuStyle({ ...style, visibility: 'visible' });
  }, []);

  const fetchPage = useCallback(
    async (nextPage, nextQuery, append = false) => {
      if (!loadOptions) return;
      if (append && loadingMoreRef.current) return;
      const rid = ++requestId.current;
      if (append) loadingMoreRef.current = true;
      setLoading(true);
      try {
        const result = await loadOptions({
          search: nextQuery,
          page: nextPage,
          limit: pageSize,
        });
        if (rid !== requestId.current) return;
        const items = normalizeOptions(result?.items || []);
        setAsyncItems((prev) => {
          const next = append ? [...prev, ...items] : items;
          const total = Number(result?.total ?? next.length);
          setHasMore(
            result?.hasMore != null
              ? Boolean(result.hasMore)
              : next.length < total && items.length > 0
          );
          return next;
        });
        setPage(nextPage);
      } catch {
        if (rid === requestId.current) {
          if (!append) setAsyncItems([]);
          setHasMore(false);
        }
      } finally {
        if (rid === requestId.current) setLoading(false);
        loadingMoreRef.current = false;
      }
    },
    [loadOptions, pageSize]
  );

  const openMenu = () => {
    if (disabled || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, 220);
    const { style } = placeFixedMenu(rect, {
      menuWidth: width,
      menuHeight: 320,
      gap: 6,
    });
    setMenuStyle({ ...style, visibility: 'hidden' });
    setQuery('');
    setOpen(true);
  };

  useEffect(() => {
    if (!open) {
      document.body.classList.remove('select-open');
      return undefined;
    }
    document.body.classList.add('select-open');
    const main = document.querySelector('.main');
    const prevMain = main?.style.overflow || '';
    if (main) main.style.overflow = 'hidden';

    const lockScroll = (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (menuRef.current?.contains(target)) {
        const list = listRef.current;
        if (!list) {
          e.preventDefault();
          return;
        }
        if (!list.contains(target) && target !== list) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        const delta = e.deltaY || 0;
        const atTop = list.scrollTop <= 0;
        const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
        if ((delta < 0 && atTop) || (delta > 0 && atBottom) || list.scrollHeight <= list.clientHeight) {
          e.preventDefault();
        }
        e.stopPropagation();
        return;
      }
      e.preventDefault();
    };

    document.addEventListener('wheel', lockScroll, { passive: false, capture: true });
    document.addEventListener('touchmove', lockScroll, { passive: false, capture: true });

    return () => {
      document.body.classList.remove('select-open');
      if (main) main.style.overflow = prevMain;
      document.removeEventListener('wheel', lockScroll, { capture: true });
      document.removeEventListener('touchmove', lockScroll, { capture: true });
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    const frame = requestAnimationFrame(() => {
      updateMenuPosition();
      searchInputRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, displayOptions.length, updateMenuPosition]);

  useEffect(() => {
    if (!open) return undefined;
    const onScroll = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      updateMenuPosition();
    };
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (
        rootRef.current?.contains(e.target) ||
        menuRef.current?.contains(e.target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (!open || !loadOptions) return undefined;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      fetchPage(1, query.trim(), false);
    }, 250);
    return () => clearTimeout(searchTimer.current);
  }, [open, query, loadOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  const onListScroll = () => {
    const el = listRef.current;
    if (!el || !loadOptions || !hasMore || loading || loadingMoreRef.current) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48) {
      fetchPage(page + 1, query.trim(), true);
    }
  };

  const selectOption = (opt) => {
    selectedMapRef.current.set(String(opt.value), opt.label);
    if (multiple) {
      const exists = selectedValues.includes(String(opt.value));
      const next = exists
        ? selectedValues.filter((v) => v !== String(opt.value))
        : [...selectedValues, String(opt.value)];
      const nextItems = next.map((v) => ({
        value: v,
        label: selectedMapRef.current.get(v) || resolveLabel(v),
      }));
      onChange?.(next, nextItems);
      return;
    }
    onChange?.(opt.value, opt);
    setOpen(false);
    setQuery('');
  };

  const clearValue = (e) => {
    e.stopPropagation();
    if (multiple) onChange?.([], []);
    else onChange?.('', null);
  };

  const removeChip = (val, e) => {
    e.stopPropagation();
    const next = selectedValues.filter((v) => v !== String(val));
    const nextItems = next.map((v) => ({
      value: v,
      label: selectedMapRef.current.get(v) || resolveLabel(v),
    }));
    onChange?.(next, nextItems);
  };

  return (
    <div
      className={`ss-select ${disabled ? 'disabled' : ''} ${multiple ? 'multiple' : ''} ${className}`}
      ref={rootRef}
    >
      <button
        type="button"
        id={id}
        ref={triggerRef}
        className={`ss-trigger ${open ? 'open' : ''} ${!selectedValues.length ? 'placeholder' : ''} ${
          invalid ? 'invalid' : ''
        }`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        onClick={() => {
          if (open) setOpen(false);
          else openMenu();
        }}
      >
        {multiple && selectedValues.length > 0 ? (
          <span className="ss-chips">
            {selectedValues.map((val) => (
              <span key={val} className="ss-chip">
                {resolveLabel(val)}
                <span
                  className="ss-chip-remove"
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => removeChip(val, e)}
                >
                  <FiX size={12} />
                </span>
              </span>
            ))}
          </span>
        ) : (
          <span className="ss-value">{selectedLabel || placeholder}</span>
        )}
        <span className="ss-actions">
          {clearable && selectedValues.length > 0 && !disabled && (
            <span
              className="ss-clear"
              role="button"
              tabIndex={-1}
              onClick={clearValue}
              onKeyDown={() => {}}
              aria-label="Clear"
            >
              <FiX size={14} />
            </span>
          )}
          <FiChevronDown size={15} className="ss-chevron" />
        </span>
      </button>

      {required ? (
        <input
          tabIndex={-1}
          aria-hidden="true"
          className="ss-hidden-required"
          value={selectedValues.length ? selectedValues.join(',') : ''}
          onChange={() => {}}
        />
      ) : null}

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              className="ss-menu"
              style={menuStyle}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.14 }}
            >
              <div className="ss-search">
                <FiSearch size={14} />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                />
              </div>
              <div
                className="ss-list hide-scrollbar"
                role="listbox"
                aria-multiselectable={multiple}
                ref={listRef}
                onScroll={onListScroll}
              >
                {loading && displayOptions.length === 0 && (
                  <div className="ss-empty">
                    <FiLoader className="spin" size={16} />
                    Loading...
                  </div>
                )}
                {!loading && displayOptions.length === 0 && (
                  <div className="ss-empty">No options found</div>
                )}
                {displayOptions.map((opt) => {
                  const active = selectedValues.includes(String(opt.value));
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`ss-option ${active ? 'active' : ''}`}
                      onClick={() => selectOption(opt)}
                    >
                      <span>
                        <strong>{opt.label}</strong>
                        {opt.meta ? <small>{opt.meta}</small> : null}
                      </span>
                      {active ? <FiCheck size={14} /> : null}
                    </button>
                  );
                })}
                {loading && displayOptions.length > 0 && (
                  <div className="ss-empty">
                    <FiLoader className="spin" size={14} />
                    Loading more...
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
