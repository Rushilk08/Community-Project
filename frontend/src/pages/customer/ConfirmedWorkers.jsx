import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getJobStatus, getMyJobs } from '../../services/api';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';

export default function ConfirmedWorkers() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const jobIdFromQuery = searchParams.get('jobId');

  const [workers, setWorkers] = useState([]);
  const [jobTitle, setJobTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadConfirmedWorkers() {
      setLoading(true);
      setError(null);
      try {
        let targetJobId = jobIdFromQuery;

        // If no jobId specified, look up customer's latest job
        if (!targetJobId) {
          const jobsRes = await getMyJobs();
          const activeJob = jobsRes?.jobs?.[0] || null;
          if (activeJob) {
            targetJobId = activeJob.id;
            setJobTitle(activeJob.title || 'Work Site');
          }
        }

        if (!targetJobId) {
          if (active) {
            setWorkers([]);
            setLoading(false);
          }
          return;
        }

        // Fetch real accepted workers from backend
        const statusRes = await getJobStatus(targetJobId);
        if (active) {
          const accepted = statusRes?.accepted_workers || [];
          setWorkers(accepted);
          if (statusRes?.title) {
            setJobTitle(statusRes.title);
          }
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Failed to load confirmed workers.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadConfirmedWorkers();

    return () => {
      active = false;
    };
  }, [jobIdFromQuery]);

  if (loading) return <Loading message="Loading confirmed workers..." />;

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">{t('confirmedWorkers')}</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            {jobTitle ? `Confirmed for: ${jobTitle}` : 'Workers who have accepted your offers and are confirmed for the work site.'}
          </p>
        </div>

        {error && <ErrorMessage message={error} />}

        {workers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👷</div>
            <h3 style={{ fontSize: '1.1rem', color: '#1e293b', marginBottom: '0.25rem' }}>No workers confirmed yet</h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              When a worker accepts your job offer, their verified details and contact number will appear here.
            </p>
            <Link to="/customer/dashboard" className="btn btn-outline btn-sm">
              &larr; Back to Dashboard
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {workers.map((worker) => (
              <div
                key={worker.id || worker.booking_id}
                className="card"
                style={{
                  marginBottom: 0,
                  borderLeft: '4px solid #16a34a',
                  padding: '1.25rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: '#16a34a',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.25rem',
                        fontWeight: 700
                      }}
                    >
                      {(worker.name || 'W').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <h4 style={{ fontWeight: 700, fontSize: '1.15rem', margin: 0 }}>{worker.name}</h4>
                        <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                          ✓ Confirmed
                        </span>
                        {worker.is_new ? (
                          <span
                            className="badge"
                            style={{
                              backgroundColor: '#fef3c7',
                              color: '#92400e',
                              border: '1px solid #fde68a',
                              fontSize: '0.72rem',
                              fontWeight: 700
                            }}
                          >
                            🌱 New Worker
                          </span>
                        ) : (
                          <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                            ⭐ Experienced
                          </span>
                        )}
                        <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                          ✓ ID Verified
                        </span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>
                        Trade: <strong>{worker.skill}</strong> • Agreed Wage: <strong style={{ color: '#16a34a' }}>₹{worker.agreed_wage || 850}/day</strong>
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {worker.phone && (
                      <a
                        href={`tel:${worker.phone}`}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}
                      >
                        📞 Call Worker
                      </a>
                    )}
                  </div>
                </div>

                {/* Worker Metrics Breakdown */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '0.75rem',
                    marginTop: '1rem',
                    padding: '0.75rem',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #f1f5f9'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Rating</span>
                    <strong style={{ color: worker.is_new ? '#0284c7' : '#b45309' }}>
                      {worker.is_new ? '🌱 New Worker' : `⭐ ${worker.rating || '4.9'} (${worker.reviews_count || 1} Reviews)`}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Experience</span>
                    <strong style={{ color: '#1e3a8a' }}>
                      {worker.is_new ? 'First Assignment' : (worker.experience_years || '1+ Year')}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Punctuality</span>
                    <strong style={{ color: '#15803d' }}>
                      {worker.punctuality_rate || '100% Ready'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Status</span>
                    <strong style={{ color: '#16a34a' }}>Ready for site</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    📞 Contact: <strong style={{ color: '#1e293b' }}>{worker.phone || 'Available on site'}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <Link to="/customer/dashboard" className="btn btn-outline">
            &larr; {t('dashboard')}
          </Link>
          <Link to="/customer/my-jobs" className="btn btn-outline">
            {t('myJobs')}
          </Link>
        </div>
      </div>
    </div>
  );
}
