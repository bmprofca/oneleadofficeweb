import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import TopNavbar from './TopNavbar';
import PageTransition from './PageTransition';

export default function Layout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('onelead_sidebar') === 'collapsed';
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 960);

  useEffect(() => {
    localStorage.setItem(
      'onelead_sidebar',
      collapsed ? 'collapsed' : 'expanded'
    );
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 960px)');
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <div
      className={`app-shell ${collapsed && !isMobile ? 'sidebar-collapsed' : ''} ${
        mobileOpen ? 'mobile-open' : ''
      }`}
    >
      <div
        className="sidebar-backdrop"
        onClick={() => setMobileOpen(false)}
        aria-hidden={!mobileOpen}
      />

      <Sidebar
        collapsed={isMobile ? false : collapsed}
        onToggle={() => setCollapsed((v) => !v)}
      />

      <div className="content-shell">
        <TopNavbar onMenuClick={() => setMobileOpen((v) => !v)} />
        <main className="main">
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
