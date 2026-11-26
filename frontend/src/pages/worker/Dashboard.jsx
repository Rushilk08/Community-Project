import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import {
  updateWorkerAvailability,
  getWorkerBookings,
  updateWorkerLocation,
  acceptOffer,
  getMyLeaves,
  cancelMyLeave
} from '../../services/api';
import useWorkerOffers from '../../hooks/useWorkerOffers';
import SlideToAccept from '../../components/SlideToAccept';
import AnimatedNumber from '../../components/AnimatedNumber';

import WorkerReferralsSection from '../../components/worker/WorkerReferralsSection';
import WorkerLeaveSection from '../../components/worker/WorkerLeaveSection';
import WorkerCancellationSection from '../../components/worker/WorkerCancellationSection';
import WorkerAvailabilityCalendar from '../../components/worker/WorkerAvailabilityCalendar';
import WorkerReviewsSection from '../../components/worker/WorkerReviewsSection';
import WorkerReplacementInvitationsSection from '../../components/worker/WorkerReplacementInvitationsSection';
import { DashboardTabs, AnimatedTabPanel } from '../../components/DashboardTabs';

export default function WorkerDashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [isAvailable, setIsAvailable] = useState(true);
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState('');
  const [acceptingOfferId, setAcceptingOfferId] = useState(null);
  const [isCancellingLeave, setIsCancellingLeave] = useState(false);
  const {
    offers,
    loading: offersLoading,
    error: offersError,
    refresh: refreshOffers
  } = useWorkerOffers({ enabled: isAvailable });

  const formatDateTime = (isoStr) => {
    if (!isoStr) return '';
    try {
      const currentLang = i18n.language ? i18n.language.split('-')[0] : 'en';
      const locale = currentLang === 'kn' ? 'kn-IN' : currentLang === 'hi' ? 'hi-IN' : 'en-IN';
      return new Date(isoStr).toLocaleString(locale, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return isoStr;
    }
  };

  const handleDashboardAccept = async (offerId) => {
    setAcceptingOfferId(offerId);
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
      setAcceptingOfferId(null);
    }
  };

  const handleCancelActiveLeave = async () => {
    if (!activeApprovedLeave) return;
    const confirmPrompt = t(
      'confirmCancelApprovedLeave',
      'Are you sure you want to cancel this approved leave and return to active work?'
    );
    if (!window.confirm(confirmPrompt)) return;

    setIsCancellingLeave(true);
    setStatusMessage(null);
    try {
      await cancelMyLeave(activeApprovedLeave.id);
      setLeaves((prev) =>
        prev.map((l) => (l.id === activeApprovedLeave.id ? { ...l, status: 'cancelled' } : l))
      );
      setIsAvailable(true);
      setStatusMessage({
        type: 'success',
        text: t('leaveCancelledSuccess', 'Leave cancelled successfully. You are now available for work.')
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to cancel leave.'
      });
    } finally {
      setIsCancellingLeave(false);
    }
  };

  const workerName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || t('worker');
  const workerSkill = user?.user_metadata?.skill;
  const activeBookings = bookings.filter((booking) => {
    const status = String(booking.status || '').toLowerCase();
    return status !== 'completed' && status !== 'cancelled';
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const activeApprovedLeave = leaves.find(
    (l) => l.status === 'approved' && todayStr >= l.start_date && todayStr <= l.end_date
  );
  const latestDecidedLeave = leaves.find(
    (l) => l.status === 'approved' || l.status === 'rejected'
  );

  useEffect(() => {
    updateWorkerAvailability(true).catch(() => {});

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          updateWorkerLocation({
            latitude: Number(pos.coords.latitude.toFixed(6)),
            longitude: Number(pos.coords.longitude.toFixed(6))
          }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [bookingsRes, leavesRes] = await Promise.all([
          getWorkerBookings().catch(() => ({ bookings: [] })),
          getMyLeaves().catch(() => ({ leaves: [] }))
        ]);
        if (active) {
          setBookings(Array.isArray(bookingsRes?.bookings) ? bookingsRes.bookings : []);
          setLeaves(Array.isArray(leavesRes?.leaves) ? leavesRes.leaves : []);
          setBookingsError('');
        }
      } catch (error) {
        if (active) setBookingsError(error.message || 'Could not load your accepted jobs.');
      } finally {
        if (active) setBookingsLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, []);

  const handleToggleAvailability = async () => {
    const nextState = !isAvailable;
    setIsUpdatingAvailability(true);
    setStatusMessage(null);

    try {
      await updateWorkerAvailability(nextState);
      setIsAvailable(nextState);
      setStatusMessage({
        type: 'success',
        text: nextState ? 'You are now visible for nearby work.' : 'You are hidden from new job offers.'
      });
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: error.message || 'Could not update your availability. Please try again.'
      });
    } finally {
      setIsUpdatingAvailability(false);
    }
  };

  const tabs = [
    { id: 'overview', label: t('tabOffersOverview', 'Offers & Overview'), icon: 'overview' },
    { id: 'calendar', label: t('tabCalendar', 'Availability Calendar'), icon: 'calendar' },
    { id: 'referrals', label: t('tabReferWorker', 'Refer a Worker'), icon: 'users' },
    { id: 'leave', label: t('tabApplyLeave', 'Apply for Leave'), icon: 'calendar' },
    { id: 'cancellations', label: t('tabCancellations', 'Cancellation Requests'), icon: 'alert' },
    { id: 'replacements', label: t('tabReplacements', 'Replacement Invitations'), icon: 'siren' },
    { id: 'reviews', label: t('tabReviews', 'Ratings & Reviews'), icon: 'star' }
  ];

  return (
    <div className="dashboard-page worker-dashboard">
      <section className="dashboard-hero worker-dashboard-hero">
        <div className="dashboard-hero-ambient" aria-hidden="true">
          <span className="dashboard-hero-glow" />
          <span className="dashboard-hero-light-sweep" />
        </div>
        <div className="dashboard-hero-copy">
          <span className="dashboard-eyebrow">{t('workerWorkspace', 'WORKER WORKSPACE')}</span>
          <h1>{t('welcome')}, {workerName}</h1>
          <p>{t('workerHeroSubtitle', 'Find nearby work, recommend peers for vacant positions, manage leave & schedule transparently.')}</p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link to="/worker/job-offers" className="dashboard-hero-cta">
              {t('browseJobOffers', 'Browse job offers')} <span aria-hidden="true">→</span>
            </Link>
            <button
              onClick={() => setActiveTab('referrals')}
              className="btn btn-outline"
              style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: '#0f172a', fontWeight: 600, borderRadius: '999px', padding: '0.65rem 1.25rem' }}
            >
              {t('referSomeone', '🤝 Refer Someone')}
            </button>
          </div>
        </div>

        <div className="availability-card" data-availability={activeApprovedLeave ? 'on-leave' : (isAvailable ? 'available' : 'unavailable')}>
          <div className="availability-card-heading">
            <span
              className={`availability-icon ${activeApprovedLeave ? 'is-on-leave' : (isAvailable ? 'is-available' : 'is-unavailable')}`}
              aria-hidden="true"
            >
              <span className="availability-icon-dot" />
            </span>
            <div>
              <span className="dashboard-overline">{t('yourStatus', 'YOUR STATUS')}</span>
              <h2>
                {activeApprovedLeave
                  ? t('onLeaveStatus', 'On Approved Leave')
                  : (isAvailable ? t('available') : t('unavailable'))}
              </h2>
            </div>
          </div>
          {activeApprovedLeave ? (
            <div style={{ marginTop: '0.25rem' }}>
              <p style={{ margin: '0 0 0.35rem', fontSize: '0.875rem', fontWeight: 600 }}>
                {activeApprovedLeave.jobs?.title || t('leaveRequest', 'Leave')} ({activeApprovedLeave.start_date} → {activeApprovedLeave.end_date})
              </p>
              {activeApprovedLeave.reviewed_at && (
                <p style={{ margin: '0 0 0.4rem', fontSize: '0.785rem', color: '#bbf7d0', fontWeight: 500 }}>
                  ✓ {t('leaveApprovedAt', 'Customer gave leave on')} {formatDateTime(activeApprovedLeave.reviewed_at)}
                </p>
              )}
              <button
                type="button"
                onClick={handleCancelActiveLeave}
                disabled={isCancellingLeave}
                className="btn btn-sm"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.25)',
                  color: '#ffffff',
                  border: '1.5px solid #ef4444',
                  fontWeight: 700,
                  fontSize: '0.825rem',
                  padding: '0.45rem 1rem',
                  borderRadius: '999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  marginTop: '0.45rem',
                  cursor: isCancellingLeave ? 'not-allowed' : 'pointer'
                }}
              >
                {isCancellingLeave ? t('updating', 'Updating…') : `✕ ${t('cancelApprovedLeave', 'Cancel Leave & Return to Work')}`}
              </button>
            </div>
          ) : (
            <>
              <p>{isAvailable ? t('availableDesc', 'You can receive new opportunities near you.') : t('unavailableDesc', 'Turn availability on when you are ready for work.')}</p>
              {latestDecidedLeave && latestDecidedLeave.status === 'rejected' && latestDecidedLeave.reviewed_at && (
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.785rem', color: '#fca5a5' }}>
                  ✕ {t('leaveDeniedAt', 'Leave denied on')} {formatDateTime(latestDecidedLeave.reviewed_at)} ({latestDecidedLeave.jobs?.title || 'Job'})
                </p>
              )}
              {latestDecidedLeave && latestDecidedLeave.status === 'approved' && latestDecidedLeave.reviewed_at && !activeApprovedLeave && (
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.785rem', color: '#bbf7d0' }}>
                  ✓ {t('leaveApprovedAt', 'Customer gave leave on')} {formatDateTime(latestDecidedLeave.reviewed_at)} ({latestDecidedLeave.start_date} → {latestDecidedLeave.end_date})
                </p>
              )}
            </>
          )}
          <button
            type="button"
            className={`availability-toggle ${isAvailable ? 'is-available' : 'is-unavailable'}`}
            onClick={handleToggleAvailability}
            disabled={isUpdatingAvailability}
            aria-pressed={isAvailable}
            style={{ marginTop: '0.75rem' }}
          >
            {isUpdatingAvailability ? t('updating', 'Updating…') : isAvailable ? t('goUnavailable', 'Go unavailable') : t('goAvailable', 'Go available')}
          </button>
          {statusMessage && (
            <p className={`dashboard-status-message ${statusMessage.type}`} role="status">
              {statusMessage.text}
            </p>
          )}
        </div>
      </section>

      <section className="dashboard-stat-grid" aria-label="Your work summary">
        <article className="dashboard-stat-card" onClick={() => setActiveTab('overview')} style={{ cursor: 'pointer' }}>
          <span className="dashboard-stat-icon offers-icon" aria-hidden="true">↗</span>
          <div>
            <p>{t('newOpportunities', 'New opportunities')}</p>
            <AnimatedNumber value={offers.length} loading={offersLoading} />
            <span>{offers.length === 1 ? t('offerWaiting', 'offer waiting for you') : t('offersWaiting', 'offers waiting for you')}</span>
          </div>
        </article>
        <article className="dashboard-stat-card" onClick={() => setActiveTab('overview')} style={{ cursor: 'pointer' }}>
          <span className="dashboard-stat-icon bookings-icon" aria-hidden="true">✓</span>
          <div>
            <p>{t('acceptedJobs', 'Accepted jobs')}</p>
            <AnimatedNumber value={activeBookings.length} loading={bookingsLoading} />
            <span>{t('currentAssignments', 'current assignments')}</span>
          </div>
        </article>
        <article className="dashboard-stat-card" onClick={() => setActiveTab('calendar')} style={{ cursor: 'pointer' }}>
          <span className="dashboard-stat-icon" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }} aria-hidden="true">
            {activeApprovedLeave ? '🏖️' : '📅'}
          </span>
          <div>
            <p>{t('availability', 'Availability')}</p>
            <strong className="dashboard-stat-skill">
              {activeApprovedLeave
                ? t('onLeaveStatus', 'On Approved Leave')
                : (isAvailable ? t('scheduleOpen', 'Schedule Open') : t('unavailable', 'Unavailable'))}
            </strong>
            <span>
              {activeApprovedLeave
                ? `${activeApprovedLeave.start_date} → ${activeApprovedLeave.end_date}`
                : t('clickToViewCalendar', 'click to view calendar')}
            </span>
          </div>
        </article>
        <article className="dashboard-stat-card" onClick={() => setActiveTab('reviews')} style={{ cursor: 'pointer' }}>
          <span className="dashboard-stat-icon skill-icon" aria-hidden="true">⭐</span>
          <div>
            <p>{t('verifiedRating', 'Verified Rating')}</p>
            <strong className="dashboard-stat-skill">4.9 ★</strong>
            <span>{t('viewPerformance', 'view performance breakdown')}</span>
          </div>
        </article>
      </section>

      {/* Feature Navigation Tabs */}
      <DashboardTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        layoutId="worker-dashboard-tab-pill"
        ariaLabel="Worker Dashboard Navigation"
      />

      {/* Tab Contents */}
      <AnimatedTabPanel tabKey={activeTab}>
        {activeTab === 'referrals' && <WorkerReferralsSection />}
        {activeTab === 'leave' && <WorkerLeaveSection />}
        {activeTab === 'cancellations' && <WorkerCancellationSection />}
        {activeTab === 'calendar' && <WorkerAvailabilityCalendar />}
        {activeTab === 'reviews' && <WorkerReviewsSection />}
        {activeTab === 'replacements' && <WorkerReplacementInvitationsSection />}

        {activeTab === 'overview' && (
        <>
          <section className="dashboard-content-grid">
            <div className="dashboard-panel">
              <div className="dashboard-panel-header">
                <div>
                  <span className="dashboard-overline">MATCHED FOR YOU</span>
                  <h2>{t('jobOffers')}</h2>
                </div>
                <Link to="/worker/job-offers" className="dashboard-text-link">See all <span aria-hidden="true">→</span></Link>
              </div>

              {offersError && (
                <div className="dashboard-inline-error" role="alert">
                  <span>{offersError.message || 'Could not load job offers.'}</span>
                  <button type="button" onClick={refreshOffers}>Try again</button>
                </div>
              )}

              {offersLoading && offers.length === 0 ? (
                <div className="dashboard-empty-state">
                  <span className="dashboard-empty-icon" aria-hidden="true">⌕</span>
                  <h3>Looking for nearby work</h3>
                  <p>New offers will appear here while you are available.</p>
                </div>
              ) : offers.length > 0 ? (
                <div className="dashboard-list">
                  {offers.slice(0, 3).map((offer, index) => {
                    const offerId = offer.id || offer.offer_id;
                    const isAccepting = acceptingOfferId === offerId;
                    return (
                      <article
                        className="dashboard-list-item"
                        key={offerId || `${offer.job_id}-${index}`}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.85rem',
                          padding: '1.15rem',
                          border: '2px solid #86efac',
                          backgroundColor: '#f0fdf4',
                          borderRadius: '12px',
                          marginBottom: '0.75rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#14532d' }}>
                                {offer.title || offer.skill || 'Local work opportunity'}
                              </h3>
                              <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>NEW OFFER</span>
                            </div>
                            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#475569' }}>
                              📍 {offer.location || 'Location shared in offer details'}
                            </p>
                          </div>
                          <strong style={{ fontSize: '1.2rem', color: '#15803d', fontWeight: 800 }}>
                            {offer.wage ? `₹${offer.wage} / day` : 'Competitive wage'}
                          </strong>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', width: '100%', marginTop: '0.25rem' }}>
                          <div style={{ flex: 1, minWidth: '180px' }}>
                            <SlideToAccept
                              onAccept={() => handleDashboardAccept(offerId)}
                              isAccepting={isAccepting}
                              label="Slide to Accept ➔"
                              height={42}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDashboardAccept(offerId)}
                            disabled={isAccepting}
                            className="btn btn-primary btn-sm"
                            style={{
                              backgroundColor: '#16a34a',
                              fontWeight: 700,
                              padding: '0.55rem 1rem',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {isAccepting ? '⏳ Accepting...' : '⚡ 1-Click Accept'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                  <Link to="/worker/job-offers" className="dashboard-panel-action">Review all job offers <span aria-hidden="true">→</span></Link>
                </div>
              ) : (
                <div className="dashboard-empty-state">
                  <span className="dashboard-empty-icon" aria-hidden="true">⌕</span>
                  <h3>No new offers just yet</h3>
                  <p>Keep your profile up to date and availability on. We’ll show matching local work here.</p>
                  <Link to="/worker/profile" className="dashboard-text-link">Review your profile <span aria-hidden="true">→</span></Link>
                </div>
              )}
            </div>

            <aside className="dashboard-side-stack">
              <div className="dashboard-panel quick-actions-panel">
                <div className="dashboard-panel-header">
                  <div>
                    <span className="dashboard-overline">WORKER TOOLS</span>
                    <h2>Quick Actions</h2>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('referrals')}
                  className="dashboard-action-link"
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <span className="dashboard-action-icon">🤝</span>
                  <span><strong>{t('tabReferWorker', 'Refer a Worker')}</strong><small>Recommend people for open vacancies</small></span>
                  <span aria-hidden="true">→</span>
                </button>
                <button
                  onClick={() => setActiveTab('leave')}
                  className="dashboard-action-link"
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <span className="dashboard-action-icon">🏖️</span>
                  <span><strong>{t('tabApplyLeave', 'Apply for Leave')}</strong><small>Request single or multi-day time off</small></span>
                  <span aria-hidden="true">→</span>
                </button>
                <button
                  onClick={() => setActiveTab('cancellations')}
                  className="dashboard-action-link"
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <span className="dashboard-action-icon">⚠️</span>
                  <span><strong>{t('tabCancellations', 'Cancel Job Commitment')}</strong><small>Request cancellation with employer approval</small></span>
                  <span aria-hidden="true">→</span>
                </button>
                <button
                  onClick={() => setActiveTab('calendar')}
                  className="dashboard-action-link"
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <span className="dashboard-action-icon">📅</span>
                  <span><strong>{t('tabCalendar', 'Availability Calendar')}</strong><small>Check your color-coded schedule</small></span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </aside>
          </section>

          <section className="dashboard-panel accepted-jobs-panel">
            <div className="dashboard-panel-header">
              <div>
                <span className="dashboard-overline">UP NEXT</span>
                <h2>{t('acceptedJob')}</h2>
              </div>
              <Link to="/worker/my-jobs" className="dashboard-text-link">View schedule <span aria-hidden="true">→</span></Link>
            </div>

            {bookingsError && <p className="dashboard-inline-error" role="alert">{bookingsError}</p>}
            {bookingsLoading ? (
              <p className="dashboard-muted">Loading your accepted jobs…</p>
            ) : activeBookings.length > 0 ? (
              <div className="dashboard-list compact-dashboard-list">
                {activeBookings.slice(0, 3).map((booking) => (
                  <article className="dashboard-list-item" key={booking.id}>
                    <span className="dashboard-list-marker confirmed-marker" aria-hidden="true">✓</span>
                    <div className="dashboard-list-copy">
                      <h3>{booking.title || 'Confirmed work'}</h3>
                      <p>{booking.location || 'Location to be confirmed'}{booking.date ? ` · ${booking.date}` : ''}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span className="badge badge-success">{booking.status || 'Confirmed'}</span>
                      <button
                        onClick={() => setActiveTab('leave')}
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      >
                        Leave
                      </button>
                      <button
                        onClick={() => setActiveTab('cancellations')}
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: '#dc2626' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="dashboard-empty-inline">
                <p>No accepted jobs yet. Explore offers to find your next assignment.</p>
                <Link to="/worker/job-offers" className="btn btn-primary btn-sm">Explore offers <span aria-hidden="true">→</span></Link>
              </div>
            )}
          </section>
        </>
      )}
      </AnimatedTabPanel>
    </div>
  );
}
