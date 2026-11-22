import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getWorkerBookings } from '../../services/api';
import Loading from '../../components/Loading';

export default function AcceptedJob() {
  const { t } = useTranslation();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBooking() {
      try {
        const res = await getWorkerBookings();
        const active = res?.bookings?.[0] || null;
        setBooking(active);
      } catch (err) {
        console.warn('Booking fetch warning:', err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchBooking();
  }, []);

  const handleNavigate = () => {
    if (booking?.location) {
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.location)}`;
      window.open(mapsUrl, '_blank');
    }
  };

  if (loading) return <Loading message="Loading job details..." />;

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto' }}>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">{t('acceptedJob')}</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Confirmed job details. Please reach the site on time.
          </p>
        </div>

        {booking ? (
          <div>
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <span className="badge badge-success" style={{ marginBottom: '0.5rem' }}>
                Confirmed
              </span>
              <h3 style={{ fontSize: '1.25rem', color: '#166534', fontWeight: 600 }}>{booking.title}</h3>
              <p style={{ color: '#15803d', fontSize: '1.1rem', fontWeight: 700, marginTop: '0.25rem' }}>
                ₹{booking.wage} / day
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="card" style={{ marginBottom: 0 }}>
                <h4 style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.25rem' }}>Customer Contact</h4>
                <p style={{ fontWeight: 600 }}>{booking.customer_name || 'Site Supervisor'}</p>
                <p style={{ color: '#1e40af' }}>{booking.customer_phone || '+91 98860 12345'}</p>
                <a
                  href={`tel:${booking.customer_phone || '+919886012345'}`}
                  className="btn btn-outline btn-sm"
                  style={{ marginTop: '0.5rem' }}
                >
                  📞 Call Customer
                </a>
              </div>

              <div className="card" style={{ marginBottom: 0 }}>
                <h4 style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.25rem' }}>{t('location')}</h4>
                <p style={{ fontWeight: 600 }}>📍 {booking.location}</p>
                <button
                  onClick={handleNavigate}
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: '0.75rem' }}
                >
                  🗺️ {t('navigate')} (Google Maps)
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <p style={{ color: '#64748b', marginBottom: '1rem' }}>
              You do not have any currently active confirmed job.
            </p>
            <Link to="/worker/job-offers" className="btn btn-primary">
              View Available Offers &rarr;
            </Link>
          </div>
        )}

        <div style={{ marginTop: '1rem' }}>
          <Link to="/worker/dashboard" className="btn btn-outline">
            &larr; {t('dashboard')}
          </Link>
        </div>
      </div>
    </div>
  );
}
