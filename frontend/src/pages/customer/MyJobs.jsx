import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getMyJobs, cancelJob } from '../../services/api';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';

export default function MyJobs() {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const loadJobs = async () => {
    try {
      const res = await getMyJobs();
      setJobs(res?.jobs || []);
    } catch (err) {
      setError(err.message || 'Failed to load jobs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleCancel = async (jobId) => {
    if (!window.confirm('Are you sure you want to cancel this job posting?')) {
      return;
    }
    setCancellingId(jobId);
    try {
      await cancelJob(jobId);
      await loadJobs();
    } catch (err) {
      alert(err.message || 'Failed to cancel job');
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) return <Loading message="Loading jobs..." />;

  return (
    <div>
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="card-title">{t('myJobs')}</h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
              Track all your active and previous daily-wage job requests.
            </p>
          </div>
          <Link to="/customer/post-job" className="btn btn-primary btn-sm">
            + {t('postJob')}
          </Link>
        </div>

        {error && <ErrorMessage message={error} />}

        {jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <p style={{ color: '#64748b', marginBottom: '1rem' }}>No jobs posted yet.</p>
            <Link to="/customer/post-job" className="btn btn-primary">
              Post Your First Job &rarr;
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {jobs.map((job) => {
              const isCancelled = job.status === 'cancelled';
              return (
                <div
                  key={job.id}
                  className="card"
                  style={{
                    margin: 0,
                    opacity: isCancelled ? 0.75 : 1,
                    backgroundColor: isCancelled ? '#f8fafc' : '#ffffff',
                    borderLeft: isCancelled ? '4px solid #94a3b8' : '4px solid #1e40af'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>{job.title}</h3>
                        <span
                          className={`badge ${
                            isCancelled
                              ? 'badge-neutral'
                              : job.status === 'in_progress'
                              ? 'badge-success'
                              : 'badge-warning'
                          }`}
                          style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}
                        >
                          {job.status}
                        </span>
                      </div>
                      <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0.35rem 0' }}>{job.description}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.85rem', color: '#334155', marginTop: '0.5rem' }}>
                        <span>📍 {job.location || job.worksite_address}</span>
                        <span>💰 ₹{job.wage || job.wage_per_worker}/day</span>
                        <span>👥 {job.confirmed_workers}/{job.workers_required || job.workers_needed} {t('confirmedWorkers')}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {!isCancelled && (
                        <button
                          type="button"
                          onClick={() => handleCancel(job.id)}
                          disabled={cancellingId === job.id}
                          className="btn btn-outline btn-sm"
                          style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                        >
                          {cancellingId === job.id ? 'Cancelling...' : '❌ Cancel'}
                        </button>
                      )}
                      <Link to={`/customer/live-hiring?jobId=${job.id}`} className="btn btn-outline btn-sm">
                        {t('liveHiring')} &rarr;
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
