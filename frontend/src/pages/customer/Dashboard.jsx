import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

export default function CustomerDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div>
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="card-title">{t('dashboard')} — {t('customer')}</h1>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
              {t('welcome')}, {user?.user_metadata?.full_name || user?.email}
            </p>
          </div>
          <Link to="/customer/post-job" className="btn btn-primary">
            + {t('postJob')}
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <h3 style={{ fontSize: '1.1rem', color: '#1e40af', marginBottom: '0.5rem' }}>{t('postJob')}</h3>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
              Create a new daily-wage labour request for your site or project.
            </p>
            <Link to="/customer/post-job" className="btn btn-primary btn-sm">
              {t('postJob')} &rarr;
            </Link>
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <h3 style={{ fontSize: '1.1rem', color: '#1e40af', marginBottom: '0.5rem' }}>{t('liveHiring')}</h3>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
              Track real-time worker responses and matching progress for open jobs.
            </p>
            <Link to="/customer/live-hiring" className="btn btn-secondary btn-sm">
              {t('liveHiring')} &rarr;
            </Link>
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <h3 style={{ fontSize: '1.1rem', color: '#1e40af', marginBottom: '0.5rem' }}>{t('myJobs')}</h3>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
              View all previously posted jobs, active assignments and records.
            </p>
            <Link to="/customer/my-jobs" className="btn btn-outline btn-sm">
              {t('myJobs')} &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
