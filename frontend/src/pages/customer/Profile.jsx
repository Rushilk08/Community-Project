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
  const { user, role, updateProfile } = useAuth();

  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobsError, setJobsError] = useState('');

  // Edit profile state
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [organization, setOrganization] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');

  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || t('customer');
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'C';

  const userPhone = user?.user_metadata?.phone || '';
  const userLocation = user?.user_metadata?.location || 'Bengaluru, Karnataka';
  const userOrg = user?.user_metadata?.organization || 'Individual / Household';

  // Initialize edit form
  useEffect(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name || '');
      setPhone(user.user_metadata?.phone || '');
      setLocation(user.user_metadata?.location || 'Bengaluru, Karnataka');
      setOrganization(user.user_metadata?.organization || 'Individual / Household');
    }
  }, [user]);

  // Load customer jobs
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
  }, []);

  const activeJobs = jobs.filter(isActive);
  const confirmedWorkers = jobs.reduce((sum, job) => sum + (Number(job.confirmed_workers) || 0), 0);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess('');

    try {
      if (updateProfile) {
        await updateProfile({
          full_name: fullName,
          phone,
          location,
          organization
        });
      }
      setSaveSuccess('Your customer profile details were updated successfully.');
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(''), 4000);
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="role-profile-page customer-profile-page">
      {/* Hero Header */}
      <header className="role-profile-hero customer-profile-hero">
        <div className="profile-avatar customer-profile-avatar" aria-hidden="true">
          {initials}
        </div>
        <div className="profile-hero-copy">
          <span className="profile-eyebrow">CUSTOMER ACCOUNT</span>
          <h1>{name}</h1>
          <p>
            Manage your hiring contact details, employer preferences, and active job requests from one dedicated space.
          </p>
        </div>
        <span className="profile-role-pill">🏢 {t('customer')}</span>
      </header>

      {/* Main Grid */}
      <div className="role-profile-grid">
        {/* Left Column: Account Details & Recent Requests */}
        <section className="role-profile-card">
          <div className="role-profile-card-heading">
            <div>
              <span className="profile-section-label">YOUR ACCOUNT</span>
              <h2>Customer account details</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                className="profile-edit-btn"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? t('cancel') : '✏️ Edit Profile'}
              </button>
              <span className="profile-card-symbol customer-symbol" aria-hidden="true">
                🏢
              </span>
            </div>
          </div>

          {saveSuccess && (
            <div className="profile-success-alert" role="status">
              <span>✓</span> {saveSuccess}
            </div>
          )}

          {isEditing ? (
            <form onSubmit={handleSaveProfile} style={{ marginTop: '0.5rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-name">{t('fullName')}</label>
                <input
                  id="edit-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="form-input"
                  placeholder="e.g. Ramesh Kumar"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-phone">{t('phoneNumber')}</label>
                <input
                  id="edit-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="form-input"
                  placeholder="e.g. +91 98765 43210"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-location">{t('location')}</label>
                <input
                  id="edit-location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="form-input"
                  placeholder="e.g. Indiranagar, Bengaluru"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-org">Hiring Category / Organization</label>
                <input
                  id="edit-org"
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="form-input"
                  placeholder="e.g. Residential Villa Renovation / ABC Builders"
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="submit" disabled={isSaving} className="btn btn-primary btn-sm">
                  {isSaving ? t('loading') : t('save')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="btn btn-outline btn-sm"
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
          ) : (
            <dl className="profile-detail-grid">
              <div className="profile-detail">
                <dt>{t('fullName')}</dt>
                <dd>{name}</dd>
              </div>
              <div className="profile-detail">
                <dt>{t('email')}</dt>
                <dd>{user?.email || 'Not provided'}</dd>
              </div>
              <div className="profile-detail">
                <dt>{t('phoneNumber')}</dt>
                <dd>{userPhone || 'Not provided'}</dd>
              </div>
              <div className="profile-detail">
                <dt>{t('role')}</dt>
                <dd>Customer / Employer</dd>
              </div>
              <div className="profile-detail">
                <dt>{t('location')}</dt>
                <dd>{userLocation}</dd>
              </div>
              <div className="profile-detail">
                <dt>Hiring Category</dt>
                <dd>{userOrg}</dd>
              </div>
            </dl>
          )}

          {/* Recent Hiring Activity */}
          <div className="profile-recent-section">
            <div className="profile-recent-section-header">
              <h3>{t('myJobs')} &amp; Recent Requests</h3>
              <Link to="/customer/my-jobs" className="customer-view-all">
                View all <span aria-hidden="true">→</span>
              </Link>
            </div>

            {loadingJobs ? (
              <p className="customer-profile-message">Loading hiring activity…</p>
            ) : jobsError ? (
              <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{jobsError}</p>
            ) : jobs.length > 0 ? (
              jobs.slice(0, 3).map((job, idx) => (
                <div className="profile-job-item" key={job.id || `job-${idx}`}>
                  <div className="profile-job-info">
                    <h4>{job.title || 'Untitled job'}</h4>
                    <p>
                      {job.location || 'Location not set'} {job.date ? `· ${job.date}` : ''}
                      {' · '}
                      <strong>{Number(job.confirmed_workers) || 0}/{Number(job.workers_required) || 0} confirmed</strong>
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className={`customer-job-state ${isActive(job) ? 'is-active' : 'is-closed'}`}>
                      {getStatus(job)}
                    </span>
                    <Link
                      to={`/customer/live-hiring?jobId=${job.id}`}
                      className="customer-recent-job-link"
                      aria-label={`View live hiring for ${job.title || 'job'}`}
                    >
                      →
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="customer-profile-empty">
                <span className="customer-recent-job-icon" aria-hidden="true">＋</span>
                <div>
                  <h3>No job requests yet</h3>
                  <p>Post your first job request to hire verified workers nearby.</p>
                </div>
                <Link to="/customer/post-job" className="btn btn-primary btn-sm">
                  {t('postJob')}
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Hiring Status Highlight & Quick Actions */}
        <aside className="profile-side-column">
          {/* Hiring Overview Highlight Card */}
          <section className="profile-highlight customer-hiring-highlight">
            <span className="profile-highlight-icon" aria-hidden="true">
              ✦
            </span>
            <span className="profile-section-label">HIRING OVERVIEW</span>
            <h2>Active Employer Account</h2>
            <p>Your hiring summary across all posted jobs and local worker requests.</p>

            <div className="profile-hiring-stats">
              <div className="profile-stat-box">
                <strong>{loadingJobs ? '—' : jobs.length}</strong>
                <span>Requests</span>
              </div>
              <div className="profile-stat-box">
                <strong>{loadingJobs ? '—' : activeJobs.length}</strong>
                <span>Active</span>
              </div>
              <div className="profile-stat-box">
                <strong>{loadingJobs ? '—' : confirmedWorkers}</strong>
                <span>Confirmed</span>
              </div>
            </div>

            <Link to="/customer/my-jobs" className="profile-inline-link">
              View full hiring history <span aria-hidden="true">→</span>
            </Link>
          </section>

          {/* Action Card */}
          <section className="profile-action-card">
            <span className="profile-section-label">NEED WORKERS NOW?</span>
            <h2>{t('postJob')}</h2>
            <p>
              Specify your trade requirement, daily wage, date, and location to connect with dependable workers.
            </p>
            <Link to="/customer/post-job" className="btn btn-primary" style={{ width: '100%' }}>
              <span aria-hidden="true">＋</span> {t('postJob')} <span aria-hidden="true">→</span>
            </Link>

            <div className="profile-action-buttons">
              <Link to="/customer/my-jobs" className="btn btn-outline btn-sm">
                📋 {t('myJobs')}
              </Link>
              <Link to="/customer/live-hiring" className="btn btn-outline btn-sm">
                ◷ {t('liveHiring')}
              </Link>
              <Link to="/customer/confirmed-workers" className="btn btn-outline btn-sm">
                ✓ {t('confirmedWorkers')}
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
