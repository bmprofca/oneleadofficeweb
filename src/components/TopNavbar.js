import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiMenu,
  FiMoon,
  FiSun,
  FiLogOut,
  FiUser,
  FiChevronDown,
  FiSettings,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const titles = {
  '/': 'Dashboard',
  '/leads': 'Leads',
  '/products': 'Products',
  '/reminders': 'Reminders',
  '/appointments': 'Appointments',
  '/users': 'Users',
  '/profile': 'Profile',
};

export default function TopNavbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const title = titles[location.pathname] || 'OneLead';

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

  const handleLogout = () => {
    logout();
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
          <h1>{title}</h1>
          <p>Centralized lead management</p>
        </div>
      </div>

      <div className="topbar-right">
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
            <span className="avatar">
              <FiUser size={14} />
            </span>
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
                  <strong>{user?.name}</strong>
                  <span>{user?.phone || user?.email}</span>
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
    </header>
  );
}
