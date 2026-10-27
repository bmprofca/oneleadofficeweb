import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiArrowRight,
  FiBarChart2,
  FiBell,
  FiCalendar,
  FiColumns,
  FiHome,
  FiLoader,
  FiSearch,
  FiSettings,
  FiSun,
  FiUser,
  FiUsers,
} from 'react-icons/fi';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { stageLabel } from '../utils/crm';

const PAGES = [
  { label: 'Dashboard', to: '/', icon: FiHome },
  { label: 'My day', to: '/tasks', icon: FiSun },
  { label: 'Leads', to: '/leads', icon: FiUsers },
  { label: 'Pipeline', to: '/pipeline', icon: FiColumns },
  { label: 'Reminders', to: '/reminders', icon: FiBell },
  { label: 'Appointments', to: '/appointments', icon: FiCalendar },
  { label: 'Reports', to: '/reports', icon: FiBarChart2 },
  { label: 'Settings', to: '/settings', icon: FiSettings, admin: true },
];

/** ⌘K / Ctrl+K palette: search leads by name, phone or email, or jump to a page. */
export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [query, setQuery] = useState('');
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setLeads([]);
    setActive(0);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const q = query.trim();
    if (q.length < 2) {
      setLeads([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/leads', { params: { search: q, page: 1, limit: 10 } });
        setLeads(data.items || []);
      } catch {
        setLeads([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [query, open]);

  const pages = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PAGES.filter((p) => (!p.admin || hasRole('admin')) && (!q || p.label.toLowerCase().includes(q)));
  }, [query, hasRole]);

  const results = useMemo(
    () => [
      ...leads.map((l) => ({ kind: 'lead', key: `l-${l.id}`, to: `/leads/${encodeURIComponent(l.id)}`, lead: l })),
      ...pages.map((p) => ({ kind: 'page', key: `p-${p.to}`, to: p.to, page: p })),
    ],
    [leads, pages]
  );

  useEffect(() => {
    setActive(0);
  }, [results.length]);

  const go = (item) => {
    if (!item) return;
    onClose();
    navigate(item.to);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[active]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="cmdk-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          onMouseDown={onClose}
        >
          <motion.div
            className="cmdk"
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="cmdk-input">
              {loading ? <FiLoader size={16} className="spin" /> : <FiSearch size={16} />}
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search leads by name, phone or email, or jump to a page…"
                aria-label="Search"
              />
              <kbd>Esc</kbd>
            </div>
            <div className="cmdk-list">
              {leads.length > 0 && <div className="cmdk-group">Leads</div>}
              {results.map((item, index) =>
                item.kind === 'lead' ? (
                  <button
                    key={item.key}
                    type="button"
                    className={`cmdk-item ${index === active ? 'active' : ''}`}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(item)}
                  >
                    <span className="cmdk-icon">
                      <FiUser size={15} />
                    </span>
                    <span className="cmdk-main">
                      <strong>{item.lead.name}</strong>
                      <small>
                        {[item.lead.phone, item.lead.product_name, item.lead.assigned_name].filter(Boolean).join(' · ')}
                      </small>
                    </span>
                    <span className={`status status-${item.lead.status}`}>{stageLabel(item.lead.status)}</span>
                  </button>
                ) : (
                  <React.Fragment key={item.key}>
                    {index === leads.length && <div className="cmdk-group">Go to</div>}
                    <button
                      type="button"
                      className={`cmdk-item ${index === active ? 'active' : ''}`}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => go(item)}
                    >
                      <span className="cmdk-icon">
                        <item.page.icon size={15} />
                      </span>
                      <span className="cmdk-main">
                        <strong>{item.page.label}</strong>
                      </span>
                      <FiArrowRight size={14} className="cmdk-go" />
                    </button>
                  </React.Fragment>
                )
              )}
              {!results.length && !loading && (
                <div className="cmdk-empty">No leads or pages match “{query.trim()}”.</div>
              )}
            </div>
            <div className="cmdk-foot">
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> navigate
              </span>
              <span>
                <kbd>↵</kbd> open
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
