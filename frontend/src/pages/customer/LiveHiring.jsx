import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useJobStatus from '../../hooks/useJobStatus';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';

export default function LiveHiring() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('jobId') || 'job-101';

  const { jobStatus, loading, error, isPolling, refresh } = useJobStatus(jobId);

  return (
    <div>
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="card-title">{t('liveHiring')}</h2>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
              Job ID: <code>{jobId}</code>
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="live-indicator">
              <span className="live-dot" />
              <span>{t('pollingActive')}</span>
            </div>
            <button onClick={refresh} className="btn btn-outline btn-sm">
              🔄 {isPolling ? t('loading') : 'Refresh'}
            </button>
          </div>
        </div>

        {error && <ErrorMessage message={error} onRetry={refresh} />}

        {loading && !jobStatus ? (
          <Loading message="Fetching live hiring status..." />
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="card" style={{ marginBottom: 0, backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }}>
                <span style={{ fontSize: '0.85rem', color: '#1e40af', fontWeight: 600 }}>{t('workersRequired')}</span>
                <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1e3a8a', marginTop: '0.25rem' }}>
                  {jobStatus?.workers_required ?? 3}
                </p>
              </div>

              <div className="card" style={{ marginBottom: 0, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
                <span style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>{t('confirmedWorkers')}</span>
                <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#14532d', marginTop: '0.25rem' }}>
                  {jobStatus?.confirmed_workers ?? 1}
                </p>
              </div>

              <div className="card" style={{ marginBottom: 0, backgroundColor: '#fefce8', borderColor: '#fef08a' }}>
                <span style={{ fontSize: '0.85rem', color: '#ca8a04', fontWeight: 600 }}>{t('pendingRequests')}</span>
                <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#713f12', marginTop: '0.25rem' }}>
                  {jobStatus?.pending_requests ?? 2}
                </p>
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>{t('confirmedWorkers')} List</h3>
              {jobStatus?.accepted_workers?.length ? (
                <ul style={{ listStyle: 'none' }}>
                  {jobStatus.accepted_workers.map((worker) => (
                    <li
                      key={worker.id}
                      style={{
                        padding: '0.75rem',
                        borderBottom: '1px solid #f1f5f9',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <strong>{worker.name}</strong> ({worker.skill})
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{worker.phone}</div>
                      </div>
                      <span className="badge badge-success">Accepted</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                  Waiting for nearby workers to accept offers...
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <Link to="/customer/confirmed-workers" className="btn btn-primary">
                {t('confirmedWorkers')}
              </Link>
              <Link to="/customer/my-jobs" className="btn btn-outline">
                {t('myJobs')}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
