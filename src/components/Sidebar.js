import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiHome,
  FiUsers,
  FiCalendar,
  FiBell,
  FiUserCheck,
  FiSidebar,
  FiBox,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/', label: 'Dashboard', icon: FiHome, end: true },
  { to: '/products', label: 'Products', icon: FiBox },
  { to: '/leads', label: 'Leads', icon: FiUsers },
  { to: '/reminders', label: 'Reminders', icon: FiBell },
  { to: '/appointments', label: 'Appointments', icon: FiCalendar },
  { to: '/users', label: 'Users', icon: FiUserCheck, roles: ['admin'] },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { hasRole } = useAuth();
  const [hoverExpand, setHoverExpand] = useState(false);
  const showLabels = !collapsed || hoverExpand;
  const showToggle = !collapsed || hoverExpand;

  return (
    <aside
      className={`sidebar ${collapsed ? 'collapsed' : ''} ${
        collapsed && hoverExpand ? 'hover-expand' : ''
      }`}
      onMouseEnter={() => collapsed && setHoverExpand(true)}
      onMouseLeave={() => setHoverExpand(false)}
    >
      <div className="sidebar-top">
        <div className="brand">
          <span className="brand-mark">OL</span>
          <AnimatePresence initial={false}>
            {showLabels && (
              <motion.div
                className="brand-text"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
              >
                <strong>OneLead</strong>
                <small>Office</small>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence initial={false}>
          {showToggle && (
            <motion.button
              type="button"
              className="icon-btn sidebar-toggle"
              onClick={onToggle}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand' : 'Collapse'}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.12 }}
            >
              <FiSidebar size={16} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <nav className="nav">
        {links
          .filter((link) => !link.roles || hasRole(...link.roles))
          .map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  isActive ? 'nav-link active' : 'nav-link'
                }
                title={link.label}
              >
                <span className="nav-icon-wrap">
                  <Icon className="nav-icon" size={18} />
                </span>
                <AnimatePresence initial={false}>
                  {showLabels && (
                    <motion.span
                      className="nav-label"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.12 }}
                    >
                      {link.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </NavLink>
            );
          })}
      </nav>
    </aside>
  );
}
