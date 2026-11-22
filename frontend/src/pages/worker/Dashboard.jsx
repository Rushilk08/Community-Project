import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { updateWorkerAvailability, getWorkerBookings, updateWorkerLocation, acceptOffer } from '../../services/api';
import useWorkerOffers from '../../hooks/useWorkerOffers';
import SlideToAccept from '../../components/SlideToAccept';

export default function WorkerDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAvailable, setIsAvailable] = useState(true);
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState('');
  const [acceptingOfferId, setAcceptingOfferId] = useState(null);
  const {
    offers,
    loading: offersLoading,
    error: offersError,
    refresh: refreshOffers
  } = useWorkerOffers({ enabled: isAvailable });

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

  const workerName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || t('worker');
  const workerSkill = user?.user_metadata?.skill;
  const activeBookings = bookings.filter((booking) => {
    const status = String(booking.status || '').toLowerCase();
    return status !== 'completed' && status !== 'cancelled';
  });

  useEffect(() => {
    // Automatically detect and update worker's live GPS coordinates and availability
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

    async function loadBookings() {
      try {
        const response = await getWorkerBookings();
        if (active) {
          setBookings(Array.isArray(response?.bookings) ? response.bookings : []);
          setBookingsError('');
        }
      } catch (error) {
        if (active) setBookingsError(error.message || 'Could not load your accepted jobs.');
      } finally {
        if (active) setBookingsLoading(false);
      }
    }

    loadBookings();
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

  return (
    <div className="dashboard-page worker-dashboard">
      <section className="dashboard-hero worker-dashboard-hero">
        <div className="dashboard-hero-copy">
          <span className="dashboard-eyebrow">WORKER WORKSPACE</span>
          <h1>{t('welcome')}, {workerName}</h1>
          <p>Find nearby work, keep track of accepted jobs, and stay in control of your availability.</p>
          <Link to="/worker/job-offers" className="dashboard-hero-cta">
            Browse job offers <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="availability-card">
          <div className="availability-card-heading">
            <span className="availability-icon" aria-hidden="true">●</span>
            <div>
              <span className="dashboard-overline">YOUR STATUS</span>
              <h2>{isAvailable ? t('available') : t('unavailable')}</h2>
            </div>
          </div>
          <p>{isAvailable ? 'You can receive new opportunities near you.' : 'Turn availability on when you are ready for work.'}</p>
          <button
            type="button"
            className={`availability-toggle ${isAvailable ? 'is-available' : 'is-unavailable'}`}
            onClick={handleToggleAvailability}
            disabled={isUpdatingAvailability}
            aria-pressed={isAvailable}
          >
            {isUpdatingAvailability ? 'Updating…' : isAvailable ? 'Go unavailable' : 'Go available'}
          </button>
          {statusMessage && (
            <p className={`dashboard-status-message ${statusMessage.type}`} role={status}>
              {statusMessage.text}
            </p>
          )}
        </div>
      </section>

      <section className="dashboard-stat-grid" aria-label="Your work summary">
        <article className="dashboard-stat-card">
          <span className="dashboard-stat-icon offers-icon" aria-hidden="true">↗</span>
          <div>
            <p>New opportunities</p>
            <strong>{offersLoading ? '—' : offers.length}</strong>
            <span>{offers.length === 1 ? 'offer waiting for you' : 'offers waiting for you'}</span>
          </div>
        </article>
        <article className="dashboard-stat-card">
          <span className="dashboard-stat-icon bookings-icon" aria-hidden="true">✓</span>
          <div>
            <p>Accepted jobs</p>
            <strong>{bookingsLoading ? '—' : activeBookings.length}</strong>
            <span>current assignments</span>
          </div>
        </article>
        <article className="dashboard-stat-card">
          <span className="dashboard-stat-icon skill-icon" aria-hidden="true">✦</span>
          <div>
            <p>Your trade</p>
            <strong className="dashboard-stat-skill">{workerSkill || 'Add your skill'}</strong>
            <span>{workerSkill ? 'shown on your profile' : 'complete your profile to get matched'}</span>
          </div>
        </article>
      </section>

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

                    {/* Both Slide bar & 1-Click Accept directly before accepting */}
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
                <span className="dashboard-overline">SHORTCUTS</span>
                <h2>Quick actions</h2>
              </div>
            </div>
            <Link to="/worker/my-jobs" className="dashboard-action-link">
              <span className="dashboard-action-icon">✓</span>
              <span><strong>My accepted jobs</strong><small>Check your work schedule</small></span>
              <span aria-hidden="true">→</span>
            </Link>
            <Link to="/worker/groups" className="dashboard-action-link">
              <span className="dashboard-action-icon">＋</span>
              <span><strong>Worker groups</strong><small>Team up for larger jobs</small></span>
              <span aria-hidden="true">→</span>
            </Link>
            <Link to="/worker/profile" className="dashboard-action-link">
              <span className="dashboard-action-icon">◉</span>
              <span><strong>Update profile</strong><small>Keep your details current</small></span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="dashboard-tip-card">
            <span className="dashboard-tip-icon" aria-hidden="true">✦</span>
            <div>
              <h3>Get noticed</h3>
              <p>Add your skills and keep your availability current to help customers find the right worker.</p>
              <Link to="/worker/profile">Complete your profile <span aria-hidden="true">→</span></Link>
            </div>
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
            {activeBookings.slice(0, 2).map((booking) => (
              <article className="dashboard-list-item" key={booking.id}>
                <span className="dashboard-list-marker confirmed-marker" aria-hidden="true">✓</span>
                <div className="dashboard-list-copy">
                  <h3>{booking.title || 'Confirmed work'}</h3>
                  <p>{booking.location || 'Location to be confirmed'}{booking.date ? ` · ${booking.date}` : ''}</p>
                </div>
                <span className="badge badge-success">{booking.status || 'Confirmed'}</span>
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
    </div>
  );
}
