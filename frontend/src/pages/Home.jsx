import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import RoleRedirect from '../routes/RoleRedirect';

export default function Home() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  // If already logged in, redirect to assigned role dashboard
  if (isAuthenticated) {
    return <RoleRedirect />;
  }

  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#1e40af', marginBottom: '1rem' }}>
          WorkSetu (ವರ್ಕ್‌ಸೇತು / वर्कसेतु)
        </h1>
        <p style={{ fontSize: '1.25rem', color: '#475569', lineHeight: 1.6 }}>
          Bridging daily-wage workers and local customers/contractors with transparency, instant offers, and fair wages.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
        <div className="card" style={{ textAlign: 'left', borderTop: '4px solid #1e40af' }}>
          <h3 style={{ fontSize: '1.3rem', color: '#1e40af', marginBottom: '0.5rem' }}>
            🏢 {t('customer')}
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
            Post job requirements, set wages, view hiring progress live, and confirm nearby skilled labourers.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link to="/register" className="btn btn-primary" style={{ flex: 1 }}>
              {t('register')}
            </Link>
            <Link to="/login" className="btn btn-outline" style={{ flex: 1 }}>
              {t('login')}
            </Link>
          </div>
        </div>

        <div className="card" style={{ textAlign: 'left', borderTop: '4px solid #059669' }}>
          <h3 style={{ fontSize: '1.3rem', color: '#059669', marginBottom: '0.5rem' }}>
            👷 {t('worker')}
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
            Turn availability ON, receive instant job offers on your phone, accept work, and get direct directions.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link to="/register" className="btn btn-secondary" style={{ flex: 1 }}>
              {t('findWork')}
            </Link>
            <Link to="/login" className="btn btn-outline" style={{ flex: 1 }}>
              {t('login')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
