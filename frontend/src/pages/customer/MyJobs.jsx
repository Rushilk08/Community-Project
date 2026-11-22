import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getMyJobs } from '../../services/api';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';

export default function MyJobs() {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadJobs() {
      try {
        const res = await getMyJobs();
        setJobs(res?.jobs || []);
      } catch (err) {
        setError(err.message || 'Failed to load jobs.');
      } finally {
        setLoading(false);
      }
    }
    loadJobs();
  }, []);

  if (loading) return <Loading message="Loading jobs..." />;

  return (
    <div>
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="card-title">{t('myJobs')}</h2>
          <Link to="/customer/post-job" className="btn btn-primary btn-sm">
            + {t('postJob')}
          </Link>
        </div>

        {error && <ErrorMessage message={error} />}

        {jobs.length === 0 ? (
          <p style={{ color: '#64748b' }}>No jobs posted yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {jobs.map((job) => (
              <div key={job.id} className="card" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{job.title}</h3>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0.25rem 0' }}>{job.description}</p>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: '#334155', marginTop: '0.5rem' }}>
                      <span>📍 {job.location}</span>
                      <span>💰 ₹{job.wage}/day</span>
                      <span>👥 {job.confirmed_workers}/{job.workers_required} {t('confirmedWorkers')}</span>
                    </div>
                  </div>
                  <Link to={`/customer/live-hiring?jobId=${job.id}`} className="btn btn-outline btn-sm">
                    {t('liveHiring')} &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
