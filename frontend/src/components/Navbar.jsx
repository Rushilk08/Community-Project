import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';
import NotificationCenter from './NotificationCenter';
import useWorkerOffers from '../hooks/useWorkerOffers';
import SlideToAccept from './SlideToAccept';
import ReferCoworkersModal from './worker/ReferCoworkersModal';
import { acceptOffer } from '../services/api';
import { playWorkOfferSound } from '../utils/audio';

export default function Navbar() {
  const { t } = useTranslation();
  const { user, role, signOut, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dismissedOfferId, setDismissedOfferId] = useState(null);
  const [isModalDismissed, setIsModalDismissed] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [referralJob, setReferralJob] = useState(null);
  const [showReferModal, setShowReferModal] = useState(false);
  const [hasRemainingTeamOnAccept, setHasRemainingTeamOnAccept] = useState(true);
  const lastAlertedOfferIdRef = useRef(null);

  const isCustomer = role === 'customer' || location.pathname.startsWith('/customer');
  const isWorker = !isCustomer && (role === 'worker' || location.pathname.startsWith('/worker'));

  // Real-time polling for incoming worker offers across the entire worker portal
  const { offers, removeOffer } = useWorkerOffers({ enabled: Boolean(isAuthenticated && isWorker) });

  const latestOffer = offers && offers.length > 0 ? offers[0] : null;
  const neededWorkersInOffer = Number(latestOffer?.workers_needed || latestOffer?.workers_required || 1);
  const remainingVacanciesInOffer = Math.max(0, neededWorkersInOffer - 1);

  const showPopup = Boolean(
    isWorker &&
    latestOffer &&
    latestOffer.id !== dismissedOfferId &&
    location.pathname !== '/worker/job-offers' &&
    location.pathname !== '/worker/accepted-job'
  );

  // Play audio alert noise and trigger vibration whenever a new offer popup appears
  useEffect(() => {
    if (latestOffer && lastAlertedOfferIdRef.current !== latestOffer.id) {
      lastAlertedOfferIdRef.current = latestOffer.id;
      setIsModalDismissed(false);
      if (showPopup) {
        playWorkOfferSound();
      }
    }
  }, [showPopup, latestOffer]);

  const handleQuickAccept = async (offerId) => {
    setIsAccepting(true);
    setDismissedOfferId(offerId);
    if (removeOffer) removeOffer(offerId);
    try {
      const res = await acceptOffer(offerId, {
        has_remaining_workers: remainingVacanciesInOffer > 0 ? hasRemainingTeamOnAccept : false
      });
      const booking = res?.booking || res?.data || {};
      const remaining = Number(res?.remaining_vacancies ?? booking.remaining_vacancies ?? 0);

      // If worker checked the box and pledged team, they fulfilled the vacancies directly!
      if (remainingVacanciesInOffer > 0 && hasRemainingTeamOnAccept) {
        navigate('/worker/accepted-job');
      } else if (remaining > 0) {
        setReferralJob({
          ...booking,
          id: booking.job_id || latestOffer?.job_id,
          title: booking.title || latestOffer?.title,
          workers_needed: booking.workers_needed || latestOffer?.workers_needed || (remaining + 1),
          confirmed_workers: booking.confirmed_workers || latestOffer?.confirmed_workers || 1,
          remaining_vacancies: remaining,
          wage: booking.wage || latestOffer?.wage,
          location: booking.location || latestOffer?.location,
          skill: booking.required_skill || latestOffer?.required_skill || latestOffer?.skill
        });
        setShowReferModal(true);
      } else {
        navigate('/worker/accepted-job');
      }
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

        {/* Right side actions: Language Switcher, Notifications, User badge, Logout */}
        <div className="nav-actions">
          <LanguageSwitcher />

          {isAuthenticated && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <NotificationCenter />
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

      {/* Real-Time Live Job Offer Centered Popup Modal */}
      {showPopup && !isModalDismissed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('newWorkOffer', 'New Work Offer!')}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100001,
            padding: '1rem',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              color: '#ffffff',
              borderRadius: '20px',
              border: '2px solid #22c55e',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.75)',
              maxWidth: '520px',
              width: '100%',
              padding: '1.75rem',
              position: 'relative'
            }}
          >
            {/* Top Bar with Live Tag, Sound Icon & Close */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span
                  style={{
                    backgroundColor: '#22c55e',
                    color: '#052e16',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: '999px',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#052e16', display: 'inline-block' }} />
                  {t('liveOpportunity', 'Live Opportunity Near You')}
                </span>
                <button
                  type="button"
                  onClick={() => playWorkOfferSound()}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.25rem',
                    cursor: 'pointer',
                    padding: 0
                  }}
                  title={t('replayAlert', 'Replay ringtone alert')}
                >
                  🔔
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsModalDismissed(true)}
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  border: 'none',
                  color: '#94a3b8',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
                title={t('close', 'Close')}
              >
                ✕
              </button>
            </div>

            {/* Job Title & Wage */}
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 0.5rem', color: '#f8fafc' }}>
              {latestOffer.title || latestOffer.skill}
            </h2>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '2.1rem', fontWeight: 900, color: '#4ade80' }}>
                ₹{latestOffer.wage}
              </span>
              <span style={{ fontSize: '0.95rem', color: '#94a3b8', fontWeight: 600 }}>
                / {t('wage', 'Daily Wage')}
              </span>
            </div>

            {/* Details Box */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem', backgroundColor: '#1e293b', padding: '0.9rem', borderRadius: '12px' }}>
              {latestOffer.location && (
                <div style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
                  📍 <strong>{t('location', 'Location')}:</strong> {latestOffer.location}
                </div>
              )}
              {latestOffer.skill && (
                <div style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
                  🛠️ <strong>{t('skill', 'Trade')}:</strong> {latestOffer.skill}
                </div>
              )}
              {latestOffer.date && (
                <div style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
                  📅 <strong>Date:</strong> {latestOffer.date} {latestOffer.duration_hours ? `(${latestOffer.duration_hours} hrs)` : ''}
                </div>
              )}
            </div>

            {/* Multi-Worker Coworker Checkbox */}
            {remainingVacanciesInOffer > 0 && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  backgroundColor: hasRemainingTeamOnAccept ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                  border: hasRemainingTeamOnAccept ? '1.5px solid #22c55e' : '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '10px',
                  padding: '0.65rem 0.85rem',
                  cursor: 'pointer',
                  marginBottom: '1.25rem',
                  userSelect: 'none'
                }}
              >
                <input
                  type="checkbox"
                  checked={hasRemainingTeamOnAccept}
                  onChange={(e) => setHasRemainingTeamOnAccept(e.target.checked)}
                  style={{ width: '20px', height: '20px', accentColor: '#22c55e', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.88rem', color: hasRemainingTeamOnAccept ? '#86efac' : '#e2e8f0', fontWeight: 700 }}>
                  {remainingVacanciesInOffer === 1
                    ? t('iHaveRemainingTeam', { count: 1 })
                    : t('iHaveRemainingTeamPlural', { count: remainingVacanciesInOffer })}
                </span>
              </label>
            )}

            {/* Actions: Slide to Accept & 1-Click Accept */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => handleQuickAccept(latestOffer.id)}
                disabled={isAccepting}
                style={{
                  width: '100%',
                  backgroundColor: '#22c55e',
                  borderColor: '#16a34a',
                  color: '#052e16',
                  fontWeight: 800,
                  fontSize: '1.05rem',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  border: 'none',
                  cursor: isAccepting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)'
                }}
              >
                {isAccepting ? '⏳ Accepting...' : t('oneClickAccept', '⚡ 1-Click Accept')}
              </button>

              <div style={{ width: '100%' }}>
                <SlideToAccept
                  onAccept={() => handleQuickAccept(latestOffer.id)}
                  isAccepting={isAccepting}
                  label={t('slideToAccept', 'Slide to Accept ➔')}
                  height={46}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.35rem' }}>
                <Link
                  to="/worker/job-offers"
                  onClick={() => setIsModalDismissed(true)}
                  style={{ color: '#93c5fd', fontSize: '0.85rem', textDecoration: 'underline' }}
                >
                  {t('viewFullDetails', 'View Full Details')}
                </Link>
                <button
                  type="button"
                  onClick={() => setDismissedOfferId(latestOffer.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    padding: '0.25rem'
                  }}
                >
                  {t('dismiss', 'Dismiss')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Live Job Offer Popup Banner: Pinned Below Full Screen */}
      {showPopup && (
        <aside
          role="alert"
          aria-live="assertive"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            width: '100%',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            padding: '1rem 1.5rem',
            borderTop: '3px solid #22c55e',
            boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.55)',
            zIndex: 100000,
            backdropFilter: 'blur(12px)',
            fontFamily: 'inherit'
          }}
        >
          <div
            style={{
              maxWidth: '1280px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1.25rem',
              flexWrap: 'wrap'
            }}
          >
            {/* Left side: Job Offer Details */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: '1 1 320px', minWidth: 0 }}>
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
                title={t('replayAlert', 'Replay ringtone alert')}
              >
                🔔
              </button>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                  <strong style={{ fontSize: '1rem', color: '#f8fafc' }}>{t('newWorkOffer', 'New Work Offer!')}</strong>
                  <span
                    style={{
                      backgroundColor: '#22c55e',
                      color: '#052e16',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      textTransform: 'uppercase'
                    }}
                  >
                    Live
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: '0.92rem', color: '#cbd5e1', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  <strong style={{ color: '#ffffff' }}>{latestOffer.title || latestOffer.skill}</strong> • <b style={{ color: '#4ade80', fontSize: '1.05rem' }}>₹{latestOffer.wage}/{t('wage', 'day')}</b>
                  {latestOffer.location && (
                    <span style={{ marginLeft: '0.65rem', color: '#94a3b8', fontSize: '0.82rem' }}>
                      📍 {latestOffer.location}
                    </span>
                  )}
                </p>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.25rem', fontSize: '0.78rem' }}>
                  <Link
                    to="/worker/job-offers"
                    style={{
                      color: '#93c5fd',
                      textDecoration: 'underline'
                    }}
                  >
                    {t('viewFullDetails', 'View Full Details')}
                  </Link>
                  <span style={{ color: '#64748b' }}>Move 👷 left ➔ right to accept</span>
                </div>
              </div>
            </div>

            {/* Right side: Team Checkbox, Slide to Accept & 1-Click Accept */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                flex: '0 1 auto',
                flexWrap: 'wrap'
              }}
            >
              {remainingVacanciesInOffer > 0 && (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    backgroundColor: hasRemainingTeamOnAccept ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                    border: hasRemainingTeamOnAccept ? '1.5px solid #22c55e' : '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    padding: '0.45rem 0.75rem',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={hasRemainingTeamOnAccept}
                    onChange={(e) => setHasRemainingTeamOnAccept(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: '#22c55e', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.82rem', color: hasRemainingTeamOnAccept ? '#86efac' : '#e2e8f0', fontWeight: 700 }}>
                    {remainingVacanciesInOffer === 1
                      ? t('iHaveRemainingTeam', { count: 1 })
                      : t('iHaveRemainingTeamPlural', { count: remainingVacanciesInOffer })}
                  </span>
                </label>
              )}

              <div style={{ width: '240px', minWidth: '200px' }}>
                <SlideToAccept
                  onAccept={() => handleQuickAccept(latestOffer.id)}
                  isAccepting={isAccepting}
                  label={t('slideToAccept', 'Slide to Accept ➔')}
                  height={44}
                />
              </div>

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
                  padding: '0.65rem 1.15rem',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  whiteSpace: 'nowrap',
                  cursor: isAccepting ? 'not-allowed' : 'pointer'
                }}
              >
                {isAccepting ? '⏳ Accepting...' : t('oneClickAccept', '⚡ 1-Click Accept')}
              </button>

              <button
                type="button"
                onClick={() => setDismissedOfferId(latestOffer.id)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  padding: '0.4rem 0.65rem',
                  borderRadius: '6px',
                  lineHeight: 1
                }}
                title={t('dismiss', 'Dismiss')}
              >
                ✕
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Refer Coworkers Modal for Multi-Worker Jobs */}
      <ReferCoworkersModal
        isOpen={showReferModal}
        job={referralJob}
        onClose={() => {
          setShowReferModal(false);
          navigate('/worker/accepted-job');
        }}
        onSuccess={() => {
          // Callback after success
        }}
      />
    </>
  );
}
