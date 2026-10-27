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
  FiSun,
  FiColumns,
  FiBarChart2,
  FiCopy,
  FiShield,
  FiSettings,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { getInitials } from '../utils/initials';

const sections = [
  {
    label: 'Workspace',
    links: [
      { to: '/', label: 'Dashboard', icon: FiHome, end: true },
      { to: '/tasks', label: 'My day', icon: FiSun },
      { to: '/leads', label: 'Leads', icon: FiUsers },
      { to: '/pipeline', label: 'Pipeline', icon: FiColumns },
      { to: '/reminders', label: 'Reminders', icon: FiBell },
      { to: '/appointments', label: 'Appointments', icon: FiCalendar },
    ],
  },
  {
    label: 'Insights',
    links: [
      { to: '/reports', label: 'Reports', icon: FiBarChart2 },
      { to: '/products', label: 'Products', icon: FiBox },
    ],
  },
  {
    label: 'Administration',
    links: [
      { to: '/users', label: 'Users', icon: FiUserCheck, roles: ['admin'] },
      { to: '/duplicates', label: 'Duplicates', icon: FiCopy, roles: ['admin'] },
      { to: '/audit', label: 'Audit log', icon: FiShield, roles: ['admin'] },
      { to: '/settings', label: 'Settings', icon: FiSettings, roles: ['admin'] },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { user, hasRole } = useAuth();
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
                <small>Office console</small>
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
              <FiSidebar size={15} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {sections.map((section) => {
        const links = section.links.filter(
          (link) => !link.roles || hasRole(...link.roles)
        );
        if (!links.length) return null;

        return (
          <div key={section.label}>
            <div className="nav-section-label">{section.label}</div>
            <nav className="nav" aria-label={section.label}>
              {links.map((link) => {
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
          </div>
        );
      })}

      <div className="sidebar-footer">
        <NavLink to="/profile" className="sidebar-user" title="Profile settings">
          <span className="avatar">{getInitials(user?.name)}</span>
          {showLabels && (
            <div className="sidebar-user-meta">
              <strong>{user?.name}</strong>
              <small>{user?.role || 'Member'}</small>
            </div>
          )}
        </NavLink>
      </div>
    </aside>
  );
}
