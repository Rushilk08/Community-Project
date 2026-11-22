import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function ConfirmedWorkers() {
  const { t } = useTranslation();

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">{t('confirmedWorkers')}</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Workers who have accepted your offers and are confirmed for the work site.
          </p>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ fontWeight: 600 }}>Manjunath K.</h4>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Skill: Mason | Phone: +91 94481 12345</p>
              <p style={{ fontSize: '0.85rem', color: '#16a34a', marginTop: '0.25rem' }}>Status: Ready for work</p>
            </div>
            <a href="tel:+919448112345" className="btn btn-secondary btn-sm">
              📞 Call Worker
            </a>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          <Link to="/customer/dashboard" className="btn btn-outline">
            &larr; {t('dashboard')}
          </Link>
        </div>
      </div>
    </div>
  );
}
