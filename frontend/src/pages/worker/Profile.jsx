import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

export default function WorkerProfile() {
  const { t } = useTranslation();
  const { user, role } = useAuth();
  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || t('worker');
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const skill = user?.user_metadata?.skill;

  return (
    <div className="role-profile-page worker-profile-page">
      <header className="role-profile-hero worker-profile-hero">
        <div className="profile-avatar" aria-hidden="true">{initials}</div>
        <div className="profile-hero-copy">
          <span className="profile-eyebrow">WORKER ACCOUNT</span>
          <h1>{name}</h1>
          <p>Keep your trade and contact details ready so you can find work that fits you.</p>
        </div>
        <span className="profile-role-pill">{t('worker')}</span>
      </header>

      <div className="role-profile-grid">
        <section className="role-profile-card">
          <div className="role-profile-card-heading">
            <div>
              <span className="profile-section-label">YOUR ACCOUNT</span>
              <h2>Worker account details</h2>
            </div>
            <span className="profile-card-symbol" aria-hidden="true">◉</span>
          </div>

          <dl className="profile-detail-grid">
            <div className="profile-detail">
              <dt>{t('fullName')}</dt>
              <dd>{user?.user_metadata?.full_name || 'Not provided'}</dd>
            </div>
            <div className="profile-detail">
              <dt>{t('email')}</dt>
              <dd>{user?.email || 'Not provided'}</dd>
            </div>
            <div className="profile-detail">
              <dt>{t('phoneNumber')}</dt>
              <dd>{user?.user_metadata?.phone || 'Not provided'}</dd>
            </div>
            <div className="profile-detail">
              <dt>{t('role')}</dt>
              <dd>{role || 'worker'}</dd>
            </div>
          </dl>
        </section>

        <aside className="profile-side-column">
          <section className="profile-highlight worker-skill-highlight">
            <span className="profile-highlight-icon" aria-hidden="true">✦</span>
            <span className="profile-section-label">YOUR TRADE</span>
            <h2>{skill || 'Skill not added yet'}</h2>
            <p>Your trade helps match you with suitable jobs nearby.</p>
          </section>

          <section className="profile-action-card">
            <span className="profile-section-label">READY FOR YOUR NEXT JOB?</span>
            <h2>Find work near you</h2>
            <p>Browse current offers and choose the work that suits your skills.</p>
            <Link to="/worker/job-offers" className="btn btn-primary">
              {t('jobOffers')} <span aria-hidden="true">→</span>
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
