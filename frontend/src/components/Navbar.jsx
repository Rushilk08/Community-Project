import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';
import useWorkerOffers from '../hooks/useWorkerOffers';
import SlideToAccept from './SlideToAccept';
import { acceptOffer } from '../services/api';
import { playWorkOfferSound } from '../utils/audio';

export default function Navbar() {
  const { t } = useTranslation();
  const { user, role, signOut, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dismissedOfferId, setDismissedOfferId] = useState(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const lastAlertedOfferIdRef = useRef(null);

  const isCustomer = role === 'customer' || location.pathname.startsWith('/customer');
  const isWorker = !isCustomer && (role === 'worker' || location.pathname.startsWith('/worker'));

  // Real-time polling for incoming worker offers across the entire worker portal
  const { offers, removeOffer } = useWorkerOffers({ enabled: Boolean(isAuthenticated && isWorker) });

  const latestOffer = offers && offers.length > 0 ? offers[0] : null;
  const showPopup = Boolean(
    isWorker &&
    latestOffer &&
    latestOffer.id !== dismissedOfferId &&
    location.pathname !== '/worker/job-offers' &&
    location.pathname !== '/worker/accepted-job'
  );

  // Play audio alert noise and trigger vibration whenever a new offer popup appears
  useEffect(() => {
    if (showPopup && latestOffer && lastAlertedOfferIdRef.current !== latestOffer.id) {
      lastAlertedOfferIdRef.current = latestOffer.id;
      playWorkOfferSound();
    }
  }, [showPopup, latestOffer]);

  const handleQuickAccept = async (offerId) => {
    setIsAccepting(true);
    setDismissedOfferId(offerId);
    if (removeOffer) removeOffer(offerId);
    try {
      await acceptOffer(offerId);
      navigate('/worker/accepted-job');
    } catch (err) {
      if (err.message && (err.message.includes('already accepted') || err.message.includes('not pending'))) {
        navigate('/worker/accepted-job');
      } else {
        alert(err.message || 'Failed to accept offer.');
      }
    } finally {
      setIsAccepting(false);
    }
  };

  if (location.pathname === '/' || location.pathname.includes('/login') || location.pathname.includes('/register')) {
    return null;
  }

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const getDashboardPath = () => {
    if (isCustomer) return '/customer/dashboard';
    if (isWorker) return '/worker/dashboard';
    return '/';
  };

  return (
    <>
      <header className="navbar">
        {/* Brand logo & name */}
        <Link to={getDashboardPath()} className="nav-brand">
          <div className="nav-brand-logo">WL</div>
          <span>WorkLink</span>
        </Link>

        {/* Navigation links based on role */}
        <nav>
          <ul className="nav-links">
            {isAuthenticated ? (
              <>
                {isCustomer && (
                  <>
                    <li>
                      <NavLink to="/customer/dashboard" className="nav-link">
                        {t('dashboard')}
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/customer/post-job" className="nav-link">
                        {t('postJob')}
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/customer/my-jobs" className="nav-link">
                        {t('myJobs')}
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/customer/live-hiring" className="nav-link">
                        {t('liveHiring')}
                      </NavLink>
                    </li>
                  </>
                )}

                {isWorker && (
                  <>
                    <li>
                      <NavLink to="/worker/dashboard" className="nav-link">
                        {t('dashboard')}
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/worker/job-offers" className="nav-link" style={{ position: 'relative' }}>
                        {t('jobOffers')}
                        {offers.length > 0 && (
                          <span
                            style={{
                              marginLeft: '6px',
                              backgroundColor: '#dc2626',
                              color: '#ffffff',
                              fontSize: '0.75rem',
                              padding: '2px 7px',
                              borderRadius: '999px',
                              fontWeight: 700
                            }}
                          >
                            {offers.length}
                          </span>
                        )}
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/worker/my-jobs" className="nav-link">
                        {t('myJobs')}
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/worker/groups" className="nav-link">
                        {t('workerGroups')}
                      </NavLink>
                    </li>
                  </>
                )}

                <li>
                  <NavLink
                    to={isCustomer ? '/customer/profile' : '/worker/profile'}
                    className="nav-link"
                  >
                    {t('profile')}
                  </NavLink>
                </li>
              </>
            ) : (
              <>
                <li>
                  <NavLink to="/login" className="nav-link">
                    {t('login')}
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/register" className="nav-link">
                    {t('register')}
                  </NavLink>
                </li>
              </>
            )}
          </ul>
        </nav>

        {/* Right side actions: Language Switcher, User badge, Logout */}
        <div className="nav-actions">
          <LanguageSwitcher />

          {isAuthenticated && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span
                className={`badge ${isCustomer ? 'badge-neutral' : 'badge-success'}`}
                title={user?.email}
              >
                {isCustomer ? t('customer') : t('worker')}
              </span>

              <button
                onClick={handleLogout}
                className="btn btn-outline btn-sm"
                title={t('logout')}
              >
                {t('logout')}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Real-Time Live Job Offer Popup Banner with Slide to Accept for Workers */}
      {showPopup && (
        <aside
          role="alert"
          aria-live="assertive"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            padding: '1.25rem 1.35rem',
            borderRadius: '16px',
            boxShadow: '0 20px 40px -5px rgba(0, 0, 0, 0.5), 0 0 0 2px #22c55e',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            width: '350px',
            maxWidth: '92vw'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => playWorkOfferSound()}
              style={{
                fontSize: '2rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1
              }}
              title="Replay ringtone alert"
            >
              🔔
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <strong style={{ fontSize: '0.98rem', color: '#f8fafc' }}>New Work Offer!</strong>
                <span
                  style={{
                    backgroundColor: '#22c55e',
                    color: '#052e16',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    textTransform: 'uppercase'
                  }}
                >
                  Live
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#94a3b8', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {latestOffer.title || latestOffer.skill} • <b style={{ color: '#4ade80' }}>₹{latestOffer.wage}/day</b>
              </p>
              {latestOffer.location && (
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: '#cbd5e1', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  📍 {latestOffer.location}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setDismissedOfferId(latestOffer.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '1.1rem',
                cursor: 'pointer',
                padding: '0 4px',
                lineHeight: 1
              }}
              title="Dismiss"
            >
              ✕
            </button>
          </div>

          {/* Slide from Left to Right to Accept OR 1-Click Accept */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
            <SlideToAccept
              onAccept={() => handleQuickAccept(latestOffer.id)}
              isAccepting={isAccepting}
              label="Slide to Accept ➔"
              height={44}
            />
            <button
              type="button"
              onClick={() => handleQuickAccept(latestOffer.id)}
              disabled={isAccepting}
              className="btn btn-primary btn-sm"
              style={{
                backgroundColor: '#22c55e',
                borderColor: '#16a34a',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
                padding: '0.45rem',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem'
              }}
            >
              {isAccepting ? '⏳ Accepting...' : '⚡ Or Tap 1-Click Accept'}
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
            <Link
              to="/worker/job-offers"
              style={{
                color: '#93c5fd',
                textDecoration: 'underline'
              }}
            >
              View Full Details
            </Link>
            <span style={{ color: '#64748b' }}>Move 👷 left ➔ right to accept</span>
          </div>
        </aside>
      )}
    </>
  );
}
