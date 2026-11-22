import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { getMyJobs } from '../../services/api';

function getJobStatus(job) {
  return String(job.status || 'Open').replace(/[_-]/g, ' ');
}

function isActiveJob(job) {
  return !['completed', 'cancelled', 'closed'].includes(getJobStatus(job).toLowerCase());
}

export default function CustomerDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const customerName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || t('customer');
  const activeJobs = jobs.filter(isActiveJob);
  const confirmedWorkers = jobs.reduce((total, job) => total + (Number(job.confirmed_workers) || 0), 0);

  useEffect(() => {
    let active = true;

    async function loadJobs() {
      try {
        const response = await getMyJobs();
        if (active) {
          setJobs(Array.isArray(response?.jobs) ? response.jobs : []);
          setError('');
        }
      } catch (loadError) {
        if (active) setError(loadError.message || 'Could not load your jobs.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadJobs();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="dashboard-page customer-dashboard">
      <section className="dashboard-hero customer-dashboard-hero">
        <div className="dashboard-hero-copy">
          <span className="dashboard-eyebrow">CUSTOMER WORKSPACE</span>
          <h1>{t('welcome')}, {customerName}</h1>
          <p>Find dependable local workers and keep every job moving from one simple place.</p>
          <div className="dashboard-hero-actions">
            <Link to="/customer/post-job" className="dashboard-hero-cta">
              <span aria-hidden="true">＋</span> {t('postJob')}
            </Link>
            <Link to="/customer/my-jobs" className="dashboard-hero-secondary">
              View your jobs <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        <div className="customer-hero-art" aria-hidden="true">
          <div className="customer-art-orbit orbit-one" />
          <div className="customer-art-orbit orbit-two" />
          <div className="customer-art-card">
            <span className="customer-art-check">✓</span>
            <span className="dashboard-overline">WORKLINK MATCH</span>
            <strong>Local talent.<br />Right on time.</strong>
            <span className="customer-art-caption">Your next project starts here</span>
          </div>
        </div>
      </section>

      <section className="dashboard-stat-grid" aria-label="Your hiring summary">
        <article className="dashboard-stat-card">
          <span className="dashboard-stat-icon offers-icon" aria-hidden="true">▤</span>
          <div>
            <p>Total jobs</p>
            <strong>{loading ? '—' : jobs.length}</strong>
            <span>requests you have posted</span>
          </div>
        </article>
        <article className="dashboard-stat-card">
          <span className="dashboard-stat-icon bookings-icon" aria-hidden="true">◷</span>
          <div>
            <p>Active jobs</p>
            <strong>{loading ? '—' : activeJobs.length}</strong>
            <span>open or in progress</span>
          </div>
        </article>
        <article className="dashboard-stat-card">
          <span className="dashboard-stat-icon skill-icon" aria-hidden="true">✓</span>
          <div>
            <p>Workers confirmed</p>
            <strong>{loading ? '—' : confirmedWorkers}</strong>
            <span>across your posted jobs</span>
          </div>
        </article>
      </section>

      <section className="dashboard-content-grid customer-dashboard-content">
        <div className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <span className="dashboard-overline">YOUR PROJECTS</span>
              <h2>{t('myJobs')}</h2>
            </div>
            <Link to="/customer/my-jobs" className="dashboard-text-link">See all <span aria-hidden="true">→</span></Link>
          </div>

          {error && <p className="dashboard-inline-error" role="alert">{error}</p>}

          {loading ? (
            <div className="dashboard-empty-state">
              <span className="dashboard-empty-icon" aria-hidden="true">◷</span>
              <h3>Loading your projects</h3>
              <p>Your latest job activity will appear here.</p>
            </div>
          ) : jobs.length > 0 ? (
            <div className="dashboard-list customer-job-list">
              {jobs.slice(0, 3).map((job, index) => (
                <article className="dashboard-list-item customer-job-item" key={job.id || `job-${index}`}>
                  <span className="dashboard-list-marker customer-job-marker" aria-hidden="true">▤</span>
                  <div className="dashboard-list-copy">
                    <h3>{job.title || 'Untitled job'}</h3>
                    <p>{job.location || 'Location not set'}{job.date ? ` · ${job.date}` : ''}</p>
                  </div>
                  <div className="customer-job-summary">
                    <span className={`dashboard-job-status ${isActiveJob(job) ? 'job-status-active' : 'job-status-closed'}`}>
                      {getJobStatus(job)}
                    </span>
                    <small>{Number(job.confirmed_workers) || 0}/{Number(job.workers_required) || 0} workers</small>
                  </div>
                  <Link to={`/customer/live-hiring?jobId=${job.id}`} className="dashboard-row-link" aria-label={`View hiring progress for ${job.title || 'job'}`}>
                    →
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty-state">
              <span className="dashboard-empty-icon" aria-hidden="true">＋</span>
              <h3>Your next project starts here</h3>
              <p>Post a job with the skills, location, and number of workers you need. We’ll keep its progress here.</p>
              <Link to="/customer/post-job" className="btn btn-primary btn-sm">Post your first job <span aria-hidden="true">→</span></Link>
            </div>
          )}
        </div>

        <aside className="dashboard-side-stack">
          <div className="dashboard-panel quick-actions-panel">
            <div className="dashboard-panel-header">
              <div>
                <span className="dashboard-overline">GET THINGS DONE</span>
                <h2>Quick actions</h2>
              </div>
            </div>
            <Link to="/customer/post-job" className="dashboard-action-link">
              <span className="dashboard-action-icon">＋</span>
              <span><strong>{t('postJob')}</strong><small>Tell us what your project needs</small></span>
              <span aria-hidden="true">→</span>
            </Link>
            <Link to="/customer/live-hiring" className="dashboard-action-link">
              <span className="dashboard-action-icon">◷</span>
              <span><strong>{t('liveHiring')}</strong><small>Follow worker responses</small></span>
              <span aria-hidden="true">→</span>
            </Link>
            <Link to="/customer/confirmed-workers" className="dashboard-action-link">
              <span className="dashboard-action-icon">✓</span>
              <span><strong>{t('confirmedWorkers')}</strong><small>Review your confirmed team</small></span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="dashboard-tip-card customer-tip-card">
            <span className="dashboard-tip-icon" aria-hidden="true">✦</span>
            <div>
              <h3>A clear job gets better matches</h3>
              <p>Add the work details, location, date, and wage so workers know exactly what to expect.</p>
              <Link to="/customer/post-job">Create a job request <span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
