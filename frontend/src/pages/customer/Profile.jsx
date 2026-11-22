import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { getMyJobs } from '../../services/api';

function getStatus(job) {
  return String(job.status || 'Open').replace(/[_-]/g, ' ');
}

function isActive(job) {
  return !['completed', 'cancelled', 'closed'].includes(getStatus(job).toLowerCase());
}

export default function CustomerProfile() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobsError, setJobsError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || t('customer');
  const activeJobs = jobs.filter(isActive);
  const confirmedWorkers = jobs.reduce((sum, job) => sum + (Number(job.confirmed_workers) || 0), 0);

  useEffect(() => {
    let active = true;

    async function loadJobs() {
      setLoadingJobs(true);
      setJobsError('');
      try {
        const response = await getMyJobs();
        if (active) setJobs(Array.isArray(response?.jobs) ? response.jobs : []);
      } catch (error) {
        if (active) setJobsError(error.message || 'Could not load your hiring activity.');
      } finally {
        if (active) setLoadingJobs(false);
      }
    }

    loadJobs();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const retryLoadingJobs = () => setReloadKey((key) => key + 1);

  return (
    <div className="customer-profile-hub">
      <header className="customer-hub-hero">
        <div className="customer-hub-copy">
          <span className="customer-hub-eyebrow">CUSTOMER PROFILE &amp; HIRING</span>
          <h1>Welcome, {name}</h1>
          <p>Manage your contact details and keep all your worker requests moving from one place.</p>
          <Link to="/customer/post-job" className="customer-hub-primary">
            <span aria-hidden="true">＋</span> {t('postJob')}
          </Link>
        </div>
        <div className="customer-hub-highlight" aria-label="Customer hiring account">
          <span className="customer-hub-highlight-icon" aria-hidden="true">⌂</span>
          <span className="customer-hub-highlight-label">YOUR ACCOUNT</span>
          <strong>Customer</strong>
          <span className="customer-hub-highlight-note">Personal hiring workspace</span>
        </div>
      </header>

      <section className="dashboard-stat-grid customer-profile-stats" aria-label="Your hiring activity">
        <article className="dashboard-stat-card">
          <span className="dashboard-stat-icon offers-icon" aria-hidden="true">▤</span>
          <div>
            <p>Total requests</p>
            <strong>{loadingJobs ? '—' : jobs.length}</strong>
            <span>jobs posted from your account</span>
          </div>
        </article>
        <article className="dashboard-stat-card">
          <span className="dashboard-stat-icon bookings-icon" aria-hidden="true">◷</span>
          <div>
            <p>In progress</p>
            <strong>{loadingJobs ? '—' : activeJobs.length}</strong>
            <span>open or active requests</span>
          </div>
        </article>
        <article className="dashboard-stat-card">
          <span className="dashboard-stat-icon skill-icon" aria-hidden="true">✓</span>
          <div>
            <p>Confirmed workers</p>
            <strong>{loadingJobs ? '—' : confirmedWorkers}</strong>
            <span>across your requests</span>
          </div>
        </article>
      </section>

      <section className="customer-profile-content">
        <section className="customer-contact-panel">
          <div className="customer-profile-section-heading">
            <div>
              <span className="customer-hub-eyebrow dark">ACCOUNT DETAILS</span>
              <h2>Contact information</h2>
            </div>
            <span className="customer-contact-icon" aria-hidden="true">◎</span>
          </div>
          <div className="customer-contact-list">
            <div className="customer-contact-row">
              <span className="customer-contact-row-icon" aria-hidden="true">♙</span>
              <div><span>{t('fullName')}</span><strong>{user?.user_metadata?.full_name || 'Not provided'}</strong></div>
            </div>
            <div className="customer-contact-row">
              <span className="customer-contact-row-icon" aria-hidden="true">@</span>
              <div><span>{t('email')}</span><strong>{user?.email || 'Not provided'}</strong></div>
            </div>
            <div className="customer-contact-row">
              <span className="customer-contact-row-icon" aria-hidden="true">☎</span>
              <div><span>{t('phoneNumber')}</span><strong>{user?.user_metadata?.phone || 'Not provided'}</strong></div>
            </div>
          </div>
          <p className="customer-contact-note">These are the account details associated with your customer sign-in.</p>
        </section>

        <aside className="customer-profile-actions">
          <span className="customer-hub-eyebrow dark">HIRING TOOLS</span>
          <h2>Manage your projects</h2>
          <p>Move from a job request to a confirmed team with these shortcuts.</p>
          <Link to="/customer/my-jobs" className="customer-profile-action-link">
            <span className="customer-profile-action-icon" aria-hidden="true">▤</span>
            <span><strong>{t('myJobs')}</strong><small>View every request</small></span>
            <span aria-hidden="true">→</span>
          </Link>
          <Link to="/customer/live-hiring" className="customer-profile-action-link">
            <span className="customer-profile-action-icon" aria-hidden="true">◷</span>
            <span><strong>{t('liveHiring')}</strong><small>Track worker responses</small></span>
            <span aria-hidden="true">→</span>
          </Link>
          <Link to="/customer/confirmed-workers" className="customer-profile-action-link">
            <span className="customer-profile-action-icon" aria-hidden="true">✓</span>
            <span><strong>{t('confirmedWorkers')}</strong><small>Review your team</small></span>
            <span aria-hidden="true">→</span>
          </Link>
        </aside>
      </section>

      <section className="customer-recent-jobs">
        <div className="customer-profile-section-heading">
          <div>
            <span className="customer-hub-eyebrow dark">RECENT ACTIVITY</span>
            <h2>Your latest job requests</h2>
          </div>
          <Link to="/customer/my-jobs" className="customer-view-all">View all jobs <span aria-hidden="true">→</span></Link>
        </div>

        {jobsError ? (
          <div className="customer-jobs-error" role="alert">
            <span>{jobsError}</span>
            <button type="button" onClick={retryLoadingJobs}>Try again</button>
          </div>
        ) : loadingJobs ? (
          <p className="customer-profile-message">Loading your job requests…</p>
        ) : jobs.length > 0 ? (
          <div className="customer-recent-list">
            {jobs.slice(0, 3).map((job, index) => (
              <article className="customer-recent-job" key={job.id || `customer-job-${index}`}>
                <span className="customer-recent-job-icon" aria-hidden="true">▤</span>
                <div className="customer-recent-job-main">
                  <h3>{job.title || 'Untitled job'}</h3>
                  <p>{job.location || 'Location not set'}{job.date ? ` · ${job.date}` : ''}</p>
                </div>
                <span className={`customer-job-state ${isActive(job) ? 'is-active' : 'is-closed'}`}>{getStatus(job)}</span>
                <Link
                  to={`/customer/live-hiring?jobId=${job.id}`}
                  className="customer-recent-job-link"
                  aria-label={`View hiring progress for ${job.title || 'job'}`}
                >
                  →
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="customer-profile-empty">
            <span className="customer-recent-job-icon" aria-hidden="true">＋</span>
            <div>
              <h3>No job requests yet</h3>
              <p>Post your first request and it will appear here with its hiring progress.</p>
            </div>
            <Link to="/customer/post-job" className="btn btn-primary btn-sm">Post a job</Link>
          </div>
        )}
      </section>
    </div>
  );
}
