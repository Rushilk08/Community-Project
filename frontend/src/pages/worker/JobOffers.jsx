import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useWorkerOffers from '../../hooks/useWorkerOffers';
import { acceptOffer, rejectOffer } from '../../services/api';
import SlideToAccept from '../../components/SlideToAccept';
import ReferCoworkersModal from '../../components/worker/ReferCoworkersModal';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';

export default function JobOffers() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { offers, loading, error, isPolling, refresh, removeOffer } = useWorkerOffers();

  const [processingId, setProcessingId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [referralJob, setReferralJob] = useState(null);
  const [showReferModal, setShowReferModal] = useState(false);
  const [teamPledges, setTeamPledges] = useState({});

  const handleAccept = async (offerId) => {
    setProcessingId(offerId);
    setActionError(null);
    const targetOffer = offers.find((o) => o.id === offerId);
    const needed = Number(targetOffer?.workers_needed || targetOffer?.workers_required || 1);
    const remainingInOffer = Math.max(0, needed - 1);
    // Defaults to true for multi-worker jobs unless unselected
    const hasTeamPledge = remainingInOffer > 0 && (teamPledges[offerId] !== false);

    try {
      const res = await acceptOffer(offerId, {
        has_remaining_workers: hasTeamPledge
      });
      if (removeOffer) removeOffer(offerId);

      const booking = res?.booking || res?.data || {};
      const remaining = Number(res?.remaining_vacancies ?? booking.remaining_vacancies ?? 0);

      if (hasTeamPledge) {
        // Direct pledge via checkbox - no typing required!
        navigate('/worker/accepted-job');
      } else if (remaining > 0) {
        setReferralJob({
          ...booking,
          id: booking.job_id || targetOffer?.job_id,
          title: booking.title || targetOffer?.title,
          workers_needed: booking.workers_needed || targetOffer?.workers_needed || (remaining + 1),
          confirmed_workers: booking.confirmed_workers || targetOffer?.confirmed_workers || 1,
          remaining_vacancies: remaining,
          wage: booking.wage || targetOffer?.wage,
          location: booking.location || targetOffer?.location,
          skill: booking.required_skill || targetOffer?.required_skill || targetOffer?.skill
        });
        setShowReferModal(true);
      } else {
        navigate('/worker/accepted-job');
      }
    } catch (err) {
      if (err.message && (err.message.includes('already accepted') || err.message.includes('not pending'))) {
        if (removeOffer) removeOffer(offerId);
        navigate('/worker/accepted-job');
      } else {
        setActionError(err.message || 'Failed to accept offer.');
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (offerId) => {
    setProcessingId(offerId);
    setActionError(null);
    try {
      await rejectOffer(offerId);
      removeOffer(offerId);
    } catch (err) {
      setActionError(err.message || 'Failed to reject offer.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div>
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="card-title">{t('jobOffers')}</h2>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
              Pending work offers dispatched to you based on your location and trade.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="live-indicator">
              <span className="live-dot" />
              <span>{t('pollingActive')}</span>
            </div>
            <button onClick={refresh} className="btn btn-outline btn-sm">
              🔄 {isPolling ? t('loading') : 'Refresh'}
            </button>
          </div>
        </div>

        {(error || actionError) && (
          <ErrorMessage message={error || actionError} onRetry={refresh} />
        )}

        {loading && offers.length === 0 ? (
          <Loading message="Checking for nearby job offers..." />
        ) : offers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <p style={{ color: '#64748b', fontSize: '1rem', marginBottom: '1rem' }}>
              {t('noOffers')}
            </p>
            <button onClick={refresh} className="btn btn-outline btn-sm">
              🔄 Check Again
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {offers.map((offer) => (
              <div
                key={offer.id}
                className="card"
                style={{
                  marginBottom: 0,
                  borderLeft: '4px solid #1e40af',
                  backgroundColor: '#ffffff'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>{offer.title}</h3>
                      <span className="badge badge-warning">{offer.skill}</span>
                    </div>

                    <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                      {offer.description}
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.875rem', color: '#1e293b' }}>
                      <div>
                        <strong>{t('wage')}:</strong> <span style={{ color: '#059669', fontWeight: 700 }}>₹{offer.wage}</span> / day
                      </div>
                      <div>
                        <strong>{t('location')}:</strong> 📍 {offer.location}
                      </div>
                      {offer.date && (
                        <div>
                          <strong>Date:</strong> 🗓️ {offer.date}
                        </div>
                      )}
                    </div>

                    {/* Team pledge checkbox for multi-worker jobs */}
                    {Number(offer.workers_needed || offer.workers_required || 1) > 1 && (
                      <div
                        style={{
                          marginTop: '0.85rem',
                          padding: '0.65rem 0.85rem',
                          backgroundColor: (teamPledges[offer.id] !== false) ? '#f0fdf4' : '#f8fafc',
                          border: (teamPledges[offer.id] !== false) ? '1.5px solid #22c55e' : '1px solid #cbd5e1',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          cursor: 'pointer'
                        }}
                        onClick={() => setTeamPledges((prev) => ({ ...prev, [offer.id]: !(prev[offer.id] !== false) }))}
                      >
                        <input
                          type="checkbox"
                          id={`pledge-${offer.id}`}
                          checked={teamPledges[offer.id] !== false}
                          onChange={(e) => setTeamPledges((prev) => ({ ...prev, [offer.id]: e.target.checked }))}
                          style={{ width: '20px', height: '20px', accentColor: '#16a34a', cursor: 'pointer' }}
                        />
                        <label
                          htmlFor={`pledge-${offer.id}`}
                          style={{
                            fontSize: '0.88rem',
                            color: (teamPledges[offer.id] !== false) ? '#15803d' : '#475569',
                            fontWeight: 700,
                            cursor: 'pointer',
                            margin: 0
                          }}
                        >
                          👥 I have remaining {Number(offer.workers_needed || offer.workers_required || 1) - 1} person{Number(offer.workers_needed || offer.workers_required || 1) - 1 > 1 ? 's' : ''} is there for this work (I will bring them)
                        </label>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleReject(offer.id)}
                      disabled={processingId === offer.id}
                      className="btn btn-outline btn-sm"
                      style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                    >
                      ❌ {t('reject')}
                    </button>
                    <SlideToAccept
                      onAccept={() => handleAccept(offer.id)}
                      isAccepting={processingId === offer.id}
                      label="Slide to Accept ➔"
                      height={42}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Refer Coworkers Modal for Multi-Worker Jobs */}
      <ReferCoworkersModal
        isOpen={showReferModal}
        job={referralJob}
        onClose={() => {
          setShowReferModal(false);
          navigate('/worker/accepted-job');
        }}
        onSuccess={() => {
          // Success callback
        }}
      />
    </div>
  );
}
