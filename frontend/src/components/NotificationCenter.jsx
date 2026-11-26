import React, { useState, useEffect, useRef } from 'react';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../services/api';

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifs = async () => {
    try {
      const res = await getNotifications();
      if (res && res.notifications) {
        setNotifications(res.notifications);
        setUnreadCount(res.unread_count || 0);
      }
    } catch {
      // Ignore network warning in background polling
    }
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 12000);

    const handleNotifRead = (e) => {
      const readId = e.detail?.id;
      if (readId) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === readId ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } else {
        fetchNotifs();
      }
    };
    window.addEventListener('worklink:notification-read', handleNotifRead);

    return () => {
      clearInterval(interval);
      window.removeEventListener('worklink:notification-read', handleNotifRead);
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      fetchNotifs();
    }
  };

  const handleMarkRead = async (id, e) => {
    e.stopPropagation();
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silent
    }
  };

  const handleMarkAllRead = async () => {
    setLoading(true);
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const getIconForType = (type) => {
    switch (type) {
      case 'referral':
        return '🤝';
      case 'leave':
        return '🏖️';
      case 'cancellation_request':
      case 'cancellation_decision':
        return '⚠️';
      case 'review':
        return '⭐';
      case 'replacement_invitation':
      case 'replacement_opportunity':
      case 'replacement_confirmed':
        return '🚨';
      default:
        return '🔔';
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className="btn btn-outline btn-sm"
        style={{
          position: 'relative',
          padding: '0.4rem 0.65rem',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          borderRadius: '8px'
        }}
        aria-label="Notifications"
        title="Notifications"
      >
        <span style={{ fontSize: '1.05rem' }}>🔔</span>
        {unreadCount > 0 && (
          <span
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              fontSize: '0.7rem',
              fontWeight: 800,
              padding: '1px 6px',
              borderRadius: '999px',
              lineHeight: 1.2
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: '340px',
            maxWidth: '90vw',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0',
            zIndex: 1000,
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    backgroundColor: '#fee2e2',
                    color: '#991b1b',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '999px'
                  }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                <span style={{ fontSize: '1.8rem', display: 'block', marginBottom: '0.5rem' }}>📭</span>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={(e) => !n.is_read && handleMarkRead(n.id, e)}
                  style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid #f1f5f9',
                    backgroundColor: n.is_read ? '#ffffff' : '#f0fdf4',
                    cursor: n.is_read ? 'default' : 'pointer',
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'flex-start',
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: '1.2rem', marginTop: '2px', flexShrink: 0 }}>
                    {getIconForType(n.type)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.825rem', color: '#0f172a' }}>
                        {n.title}
                      </strong>
                      {!n.is_read && (
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            backgroundColor: '#16a34a',
                            flexShrink: 0
                          }}
                        />
                      )}
                    </div>
                    <p
                      style={{
                        margin: '0.2rem 0 0',
                        fontSize: '0.785rem',
                        color: '#475569',
                        lineHeight: 1.35
                      }}
                    >
                      {n.message}
                    </p>
                    <span style={{ fontSize: '0.675rem', color: '#94a3b8', marginTop: '4px', display: 'inline-block' }}>
                      {n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
