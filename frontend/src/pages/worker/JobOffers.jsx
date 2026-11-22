import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useWorkerOffers from '../../hooks/useWorkerOffers';
import { acceptOffer, rejectOffer } from '../../services/api';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';

export default function JobOffers() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { offers, loading, error, isPolling, refresh, removeOffer } = useWorkerOffers();

  const [processingId, setProcessingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const handleAccept = async (offerId) => {
    setProcessingId(offerId);
    setActionError(null);
    try {
      await acceptOffer(offerId);
      removeOffer(offerId);
      navigate('/worker/accepted-job');
    } catch (err) {
      setActionError(err.message || 'Failed to accept offer.');
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
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button
                      onClick={() => handleReject(offer.id)}
                      disabled={processingId === offer.id}
                      className="btn btn-outline"
                      style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                    >
                      ❌ {t('reject')}
                    </button>
                    <button
                      onClick={() => handleAccept(offer.id)}
                      disabled={processingId === offer.id}
                      className="btn btn-secondary"
                    >
                      {processingId === offer.id ? t('loading') : `✅ ${t('accept')}`}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
