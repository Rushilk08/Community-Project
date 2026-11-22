import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getWorkerBookings } from '../../services/api';
import Loading from '../../components/Loading';

export default function WorkerMyJobs() {
  const { t } = useTranslation();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBookings() {
      try {
        const res = await getWorkerBookings();
        setBookings(res?.bookings || []);
      } catch (err) {
        console.warn('Could not load bookings:', err.message);
      } finally {
        setLoading(false);
      }
    }
    loadBookings();
  }, []);

  if (loading) return <Loading message="Loading completed and active jobs..." />;

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">{t('myJobs')}</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Past and current accepted work assignments.
          </p>
        </div>

        {bookings.length === 0 ? (
          <p style={{ color: '#64748b' }}>No jobs recorded yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {bookings.map((booking) => (
              <div key={booking.id} className="card" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{booking.title}</h3>
                    <p style={{ color: '#64748b', fontSize: '0.85rem' }}>📍 {booking.location} | ₹{booking.wage}/day</p>
                    <p style={{ fontSize: '0.85rem', color: '#334155', marginTop: '0.25rem' }}>Customer: {booking.customer_name}</p>
                  </div>
                  <span className="badge badge-success">{booking.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '1.5rem' }}>
          <Link to="/worker/dashboard" className="btn btn-outline">
            &larr; {t('dashboard')}
          </Link>
        </div>
      </div>
    </div>
  );
}
