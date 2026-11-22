import React from 'react';
import { useTranslation } from 'react-i18next';

export default function ErrorMessage({
  title,
  message,
  onRetry,
  className = ''
}) {
  const { t } = useTranslation();

  return (
    <div
      className={`card ${className}`}
      style={{
        borderLeft: '4px solid #dc2626',
        backgroundColor: '#fef2f2',
        color: '#991b1b',
        padding: '1.25rem'
      }}
      role="alert"
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>⚠️</span>
        <div style={{ flex: 1 }}>
          <h4 style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem', color: '#991b1b' }}>
            {title || t('error')}
          </h4>
          <p style={{ fontSize: '0.9rem', color: '#7f1d1d' }}>
            {typeof message === 'string' ? message : message?.message || 'An unexpected error occurred.'}
          </p>

          {onRetry && (
            <button
              onClick={onRetry}
              className="btn btn-outline btn-sm"
              style={{
                marginTop: '0.75rem',
                borderColor: '#dc2626',
                color: '#dc2626',
                backgroundColor: '#ffffff'
              }}
            >
              🔄 {t('retry')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
