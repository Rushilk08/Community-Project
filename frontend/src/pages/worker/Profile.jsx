import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

export default function WorkerProfile() {
  const { t } = useTranslation();
  const { user, role } = useAuth();

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">{t('profile')} — {t('worker')}</h2>
        </div>

        <div className="form-group">
          <label className="form-label">{t('fullName')}</label>
          <input
            type="text"
            readOnly
            value={user?.user_metadata?.full_name || 'Worker Name'}
            className="form-input"
            style={{ backgroundColor: '#f8fafc' }}
          />
        </div>

        <div className="form-group">
          <label className="form-label">{t('email')}</label>
          <input
            type="email"
            readOnly
            value={user?.email || ''}
            className="form-input"
            style={{ backgroundColor: '#f8fafc' }}
          />
        </div>

        <div className="form-group">
          <label className="form-label">{t('skill')}</label>
          <input
            type="text"
            readOnly
            value={user?.user_metadata?.skill || 'General Labour'}
            className="form-input"
            style={{ backgroundColor: '#f8fafc' }}
          />
        </div>

        <div className="form-group">
          <label className="form-label">{t('role')}</label>
          <input
            type="text"
            readOnly
            value={role}
            className="form-input"
            style={{ backgroundColor: '#f8fafc', textTransform: 'capitalize' }}
          />
        </div>
      </div>
    </div>
  );
}
