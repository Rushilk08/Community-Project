import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { getMyJobs } from '../../services/api';
import AnimatedNumber from '../../components/AnimatedNumber';

import CustomerRecommendedWorkersSection from '../../components/customer/CustomerRecommendedWorkersSection';
import CustomerLeaveManagementSection from '../../components/customer/CustomerLeaveManagementSection';
import CustomerCancellationRequestsSection from '../../components/customer/CustomerCancellationRequestsSection';
import CustomerWorkerReviewsSection from '../../components/customer/CustomerWorkerReviewsSection';
import { DashboardTabs, AnimatedTabPanel } from '../../components/DashboardTabs';
import CustomerEmergencyReplacementSection from '../../components/customer/CustomerEmergencyReplacementSection';

function getJobStatus(job) {
  return String(job.status || 'Open').replace(/[_-]/g, ' ');
}

function isActiveJob(job) {
  return !['completed', 'cancelled', 'closed'].includes(getJobStatus(job).toLowerCase());
}

export default function CustomerDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [replacementParams, setReplacementParams] = useState(null);
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

  const handleLaunchReplacement = (params) => {
    setReplacementParams(params);
    setActiveTab('replacement');
  };

  const tabs = [
    { id: 'overview', label: 'Posted Jobs & Overview', icon: 'overview' },
    { id: 'recommended', label: 'Recommended Candidates', icon: 'users' },
    { id: 'leaves', label: 'Leave Requests', icon: 'calendar' },
    { id: 'cancellations', label: 'Cancellation Requests', icon: 'alert' },
    { id: 'replacement', label: 'Emergency Replacement', icon: 'siren' },
    { id: 'reviews', label: 'Rate & Review Workers', icon: 'star' }
  ];

  return (
    <div className="dashboard-page customer-dashboard">
      <section className="dashboard-hero customer-dashboard-hero">
        <div className="dashboard-hero-ambient" aria-hidden="true">
          <span className="dashboard-hero-glow" />
          <span className="dashboard-hero-light-sweep" />
        </div>
        <div className="dashboard-hero-copy">
          <span className="dashboard-eyebrow">CUSTOMER WORKSPACE</span>
          <h1>{t('welcome')}, {customerName}</h1>
          <p>Hire verified workers, review recommendations, manage leaves and emergency replacements seamlessly.</p>
          <div className="dashboard-hero-actions">
            <Link to="/customer/post-job" className="dashboard-hero-cta">
              <span aria-hidden="true">＋</span> {t('postJob')}
            </Link>
            <button
              onClick={() => setActiveTab('replacement')}
              className="btn btn-outline"
              style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: '#0f172a', fontWeight: 600, borderRadius: '999px', padding: '0.65rem 1.25rem' }}
            >
              🚨 Find Replacement
            </button>
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
            <span className="customer-art-caption">Emergency replacements & verified reviews</span>
          </div>
        </div>
      </section>

      <section className="dashboard-stat-grid" aria-label="Your hiring summary">
        <article className="dashboard-stat-card" onClick={() => setActiveTab('overview')} style={{ cursor: 'pointer' }}>
          <span className="dashboard-stat-icon offers-icon" aria-hidden="true">▤</span>
          <div>
            <p>Total jobs</p>
            <AnimatedNumber value={jobs.length} loading={loading} />
            <span>requests you have posted</span>
          </div>
        </article>
        <article className="dashboard-stat-card" onClick={() => setActiveTab('overview')} style={{ cursor: 'pointer' }}>
          <span className="dashboard-stat-icon bookings-icon" aria-hidden="true">◷</span>
          <div>
            <p>Active jobs</p>
            <AnimatedNumber value={activeJobs.length} loading={loading} />
            <span>open or in progress</span>
          </div>
        </article>
        <article className="dashboard-stat-card" onClick={() => setActiveTab('recommended')} style={{ cursor: 'pointer' }}>
          <span className="dashboard-stat-icon" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }} aria-hidden="true">🤝</span>
          <div>
            <p>Recommendations</p>
            <strong className="dashboard-stat-skill">Candidates Ready</strong>
            <span>review referred workers</span>
          </div>
        </article>
        <article className="dashboard-stat-card" onClick={() => setActiveTab('leaves')} style={{ cursor: 'pointer' }}>
          <span className="dashboard-stat-icon" style={{ backgroundColor: '#fef3c7', color: '#d97706' }} aria-hidden="true">🏖️</span>
          <div>
            <p>Leave & Status</p>
            <strong className="dashboard-stat-skill">Leave Requests</strong>
            <span>review worker requests</span>
          </div>
        </article>
      </section>

      {/* Feature Navigation Tabs */}
      <DashboardTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        layoutId="customer-dashboard-tab-pill"
        ariaLabel="Customer Dashboard Navigation"
      />

      {/* Tab Contents */}
      <AnimatedTabPanel tabKey={activeTab}>
        {activeTab === 'recommended' && <CustomerRecommendedWorkersSection />}
        {activeTab === 'leaves' && <CustomerLeaveManagementSection onFindReplacement={handleLaunchReplacement} />}
        {activeTab === 'cancellations' && <CustomerCancellationRequestsSection onFindReplacement={handleLaunchReplacement} />}
        {activeTab === 'replacement' && <CustomerEmergencyReplacementSection initialParams={replacementParams} />}
        {activeTab === 'reviews' && <CustomerWorkerReviewsSection />}

        {activeTab === 'overview' && (
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
                      <small>{Number(job.confirmed_workers) || 0}/{Number(job.workers_required || job.workers_needed) || 0} workers</small>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        onClick={() => handleLaunchReplacement({ job_id: job.id, skill: job.required_skill || job.skill, title: job.title })}
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      >
                        🚨 Replacement
                      </button>
                      <Link to={`/customer/live-hiring?jobId=${job.id}`} className="dashboard-row-link" aria-label={`View hiring progress for ${job.title || 'job'}`}>
                        →
                      </Link>
                    </div>
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
                  <span className="dashboard-overline">MANAGEMENT TOOLS</span>
                  <h2>Quick actions</h2>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('recommended')}
                className="dashboard-action-link"
                style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <span className="dashboard-action-icon">🤝</span>
                <span><strong>Recommended Workers</strong><small>View candidate referrals</small></span>
                <span aria-hidden="true">→</span>
              </button>
              <button
                onClick={() => setActiveTab('leaves')}
                className="dashboard-action-link"
                style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <span className="dashboard-action-icon">🏖️</span>
                <span><strong>Leave Management</strong><small>Review & approve time off</small></span>
                <span aria-hidden="true">→</span>
              </button>
              <button
                onClick={() => setActiveTab('replacement')}
                className="dashboard-action-link"
                style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <span className="dashboard-action-icon">🚨</span>
                <span><strong>Emergency Replacement</strong><small>Instantly fill vacant positions</small></span>
                <span aria-hidden="true">→</span>
              </button>
              <button
                onClick={() => setActiveTab('cancellations')}
                className="dashboard-action-link"
                style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <span className="dashboard-action-icon">⚠️</span>
                <span><strong>Cancellation Requests</strong><small>Worker release requests</small></span>
                <span aria-hidden="true">→</span>
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className="dashboard-action-link"
                style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <span className="dashboard-action-icon">⭐</span>
                <span><strong>Rate Completed Work</strong><small>5-category worker evaluations</small></span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </aside>
        </section>
      )}
      </AnimatedTabPanel>
    </div>
  );
}
