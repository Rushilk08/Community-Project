import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { updateWorkerAvailability } from '../../services/api';
import useWorkerOffers from '../../hooks/useWorkerOffers';

export default function WorkerDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [isAvailable, setIsAvailable] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');

  const { offers } = useWorkerOffers({ enabled: isAvailable });

  const handleToggleAvailability = async () => {
    const nextState = !isAvailable;
    setIsAvailable(nextState);
    try {
      await updateWorkerAvailability(nextState);
      setStatusMsg(nextState ? 'Status set to Available' : 'Status set to Unavailable');
    } catch (err) {
      console.warn('Availability update warning:', err.message);
    }
  };

  return (
    <div>
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="card-title">{t('dashboard')} — {t('worker')}</h1>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
              {t('welcome')}, {user?.user_metadata?.full_name || user?.email}
            </p>
          </div>

          {/* Availability Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
              {t('availabilityStatus')}:
            </span>
            <button
              onClick={handleToggleAvailability}
              className={`btn ${isAvailable ? 'btn-secondary' : 'btn-outline'}`}
              style={{ minWidth: '130px' }}
            >
              {isAvailable ? `🟢 ${t('available')}` : `⚪ ${t('unavailable')}`}
            </button>
          </div>
        </div>

        {statusMsg && (
          <p style={{ fontSize: '0.85rem', color: '#059669', marginBottom: '1rem' }}>
            {statusMsg}
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          <div className="card" style={{ marginBottom: 0, borderTop: '3px solid #1e40af' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', color: '#1e40af' }}>{t('jobOffers')}</h3>
              {offers.length > 0 && (
                <span className="badge badge-warning">{offers.length} New</span>
              )}
            </div>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0.5rem 0 1rem' }}>
              Nearby contractor requests waiting for your confirmation.
            </p>
            <Link to="/worker/job-offers" className="btn btn-primary btn-sm">
              {t('jobOffers')} &rarr;
            </Link>
          </div>

          <div className="card" style={{ marginBottom: 0, borderTop: '3px solid #059669' }}>
            <h3 style={{ fontSize: '1.1rem', color: '#059669', marginBottom: '0.5rem' }}>{t('acceptedJob')}</h3>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
              View site details and start turn-by-turn navigation for accepted work.
            </p>
            <Link to="/worker/accepted-job" className="btn btn-secondary btn-sm">
              {t('acceptedJob')} &rarr;
            </Link>
          </div>

          <div className="card" style={{ marginBottom: 0, borderTop: '3px solid #d97706' }}>
            <h3 style={{ fontSize: '1.1rem', color: '#d97706', marginBottom: '0.5rem' }}>{t('workerGroups')}</h3>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
              Team up with family members or co-workers for higher-demand group jobs.
            </p>
            <Link to="/worker/groups" className="btn btn-outline btn-sm">
              {t('workerGroups')} &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
