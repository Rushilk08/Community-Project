import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TAB_ICONS = {
  overview: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  users: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  calendar: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  alert: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  siren: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  star: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
};

export function DashboardTabs({ tabs, activeTab, onChange, layoutId = 'dashboard-tab-pill', ariaLabel = 'Dashboard Navigation' }) {
  return (
    <nav className="wl-tabs-dock" aria-label={ariaLabel} role="tablist">
      <div className="wl-tabs-track">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const iconEl = TAB_ICONS[tab.icon] || null;
          return (
            <motion.button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`wl-tab-btn ${isActive ? 'is-active' : ''}`}
              whileHover={isActive ? undefined : { y: -1 }}
              whileTap={{ scale: 0.97 }}
            >
              {isActive && (
                <motion.span
                  layoutId={layoutId}
                  className="wl-tab-active-bg"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
              <span className="wl-tab-content">
                {iconEl && <span className="wl-tab-icon" aria-hidden="true">{iconEl}</span>}
                <span>{tab.label}</span>
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}

export function AnimatedTabPanel({ tabKey, children }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tabKey}
        className="wl-tab-panel"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
