import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiMenu,
  FiMoon,
  FiSun,
  FiLogOut,
  FiChevronDown,
  FiSettings,
  FiChevronRight,
  FiCalendar,
  FiSearch,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getInitials } from '../utils/initials';
import CommandPalette from './CommandPalette';

const titles = {
  '/': 'Dashboard',
  '/leads': 'Leads',
  '/products': 'Products',
  '/reminders': 'Reminders',
  '/appointments': 'Appointments',
  '/users': 'Users',
  '/profile': 'Profile',
  '/tasks': 'My day',
  '/pipeline': 'Pipeline',
  '/reports': 'Reports',
  '/duplicates': 'Duplicates',
  '/audit': 'Audit log',
  '/settings': 'Settings',
};

export default function TopNavbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const menuRef = useRef(null);
  const title =
    titles[location.pathname] ||
    (location.pathname.startsWith('/leads/') ? 'Lead details' : 'OneLead');
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="icon-btn mobile-menu"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <FiMenu size={18} />
        </button>
        <div className="topbar-title">
          <p className="topbar-crumbs">
            <span>OneLead</span>
            <FiChevronRight size={13} />
            <strong>{title}</strong>
          </p>
        </div>
      </div>

      <div className="topbar-right">
        <button type="button" className="topbar-search" onClick={() => setSearchOpen(true)}>
          <FiSearch size={15} />
          <span>Search leads…</span>
          <kbd>{isMac ? '⌘' : 'Ctrl'} K</kbd>
        </button>
        <span className="topbar-date">
          <FiCalendar size={13} />
          {today}
        </span>
        <span className="topbar-divider" />
        <motion.button
          type="button"
          className="icon-btn"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title={isDark ? 'Switch to light' : 'Switch to dark'}
          whileTap={{ scale: 0.92 }}
        >
          {isDark ? <FiSun size={17} /> : <FiMoon size={17} />}
        </motion.button>

        <div className="profile-menu" ref={menuRef}>
          <button
            type="button"
            className="profile-trigger"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            <span className="avatar">{getInitials(user?.name)}</span>
            <div className="topbar-user-meta">
              <strong>{user?.name}</strong>
            </div>
            <FiChevronDown size={14} className={open ? 'chevron open' : 'chevron'} />
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                className="profile-dropdown"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <div className="profile-dropdown-head">
                  <span className="avatar lg">{getInitials(user?.name)}</span>
                  <div>
                    <strong>{user?.name}</strong>
                    <span>{user?.phone || user?.email}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="profile-item"
                  onClick={() => {
                    setOpen(false);
                    navigate('/profile');
                  }}
                >
                  <FiSettings size={15} />
                  Profile settings
                </button>
                <button
                  type="button"
                  className="profile-item danger"
                  onClick={handleLogout}
                >
                  <FiLogOut size={15} />
                  Logout
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
