import React from 'react';
import { useTranslation } from 'react-i18next';

export default function Loading({ message, fullScreen = false }) {
  const { t } = useTranslation();
  const displayMessage = message || t('loading');

  const containerStyle = fullScreen
    ? {
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem'
      };

  return (
    <div style={containerStyle} role="status" aria-live="polite">
      <div
        style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e2e8f0',
          borderTop: '4px solid #1e40af',
          borderRadius: '50%',
          animation: 'worklink-spin 0.9s linear infinite',
          marginBottom: '1rem'
        }}
      />
      <p style={{ color: '#64748b', fontSize: '0.95rem', fontWeight: 500 }}>
        {displayMessage}
      </p>

      <style>{`
        @keyframes worklink-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
