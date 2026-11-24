import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createWorkerRequest, getBookingRequests, getWorkerBookings } from '../../services/api';
import Loading from '../../components/Loading';

export default function AcceptedJob() {
  const { t } = useTranslation();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [requestType, setRequestType] = useState('overtime_pay');
  const [requestedExtraPay, setRequestedExtraPay] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [requestError, setRequestError] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  useEffect(() => {
    async function fetchBooking() {
      try {
        const res = await getWorkerBookings();
        const active = res?.bookings?.find((item) => ['confirmed', 'in_progress'].includes(item.status)) || null;
        setBooking(active);
        if (active?.id) {
          try {
            const requestResponse = await getBookingRequests(active.id);
            setRequests(Array.isArray(requestResponse?.requests) ? requestResponse.requests : []);
          } catch (requestLoadError) {
            setRequestError(requestLoadError.message || 'Could not load worker requests.');
          }
        }
      } catch (err) {
        console.warn('Booking fetch warning:', err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchBooking();
  }, []);

  const handleRequestSubmit = async (event) => {
    event.preventDefault();
    if (!booking?.id) return;

    setIsSubmittingRequest(true);
    setRequestError('');
    setRequestMessage('');
    try {
      const requestData = {
        request_type: requestType,
        reason: requestReason.trim(),
        ...(requestType === 'overtime_pay' ? { requested_extra_pay: Number(requestedExtraPay) } : {})
      };
      const response = await createWorkerRequest(booking.id, requestData);
      setRequests((current) => [response.request, ...current]);
      setRequestReason('');
      setRequestedExtraPay('');
      setRequestMessage(t('requestSent'));
    } catch (err) {
      setRequestError(err.message || 'Could not send your request.');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const approvedOvertimeTotal = requests
    .filter((item) => item.request_type === 'overtime_pay' && item.status === 'approved')
    .reduce((total, item) => total + (Number(item.requested_extra_pay) || 0), 0);

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
              {approvedOvertimeTotal > 0 && (
                <p className="approved-overtime-total">
                  {t('approvedOvertimeAddOns')}: ₹{approvedOvertimeTotal.toLocaleString()}
                </p>
              )}
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

            {['confirmed', 'in_progress'].includes(booking.status) && (
              <section className="worker-request-panel" aria-labelledby="worker-request-heading">
                <h3 id="worker-request-heading">{t('workerRequestTitle')}</h3>
                <p className="worker-request-hint">
                  {t('leaveDateForBooking')}: {booking.date || '—'}. The customer must approve or decline each request.
                </p>
                <form onSubmit={handleRequestSubmit}>
                  <label className="form-label" htmlFor="worker-request-type">{t('requestType')}</label>
                  <select
                    id="worker-request-type"
                    className="form-select"
                    value={requestType}
                    onChange={(event) => setRequestType(event.target.value)}
                  >
                    <option value="overtime_pay">{t('overtimePayRequest')}</option>
                    <option value="leave">{t('leaveRequest')}</option>
                  </select>

                  {requestType === 'overtime_pay' && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="worker-request-amount">{t('requestExtraAmount')}</label>
                      <input
                        id="worker-request-amount"
                        className="form-input"
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        value={requestedExtraPay}
                        onChange={(event) => setRequestedExtraPay(event.target.value)}
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label" htmlFor="worker-request-reason">{t('requestReason')}</label>
                    <textarea
                      id="worker-request-reason"
                      className="form-textarea"
                      minLength={5}
                      maxLength={500}
                      required
                      rows={3}
                      value={requestReason}
                      onChange={(event) => setRequestReason(event.target.value)}
                      placeholder={t('requestReasonPlaceholder')}
                    />
                  </div>

                  {requestError && <p className="worker-request-error" role="alert">{requestError}</p>}
                  {requestMessage && <p className="worker-request-success" role="status">{requestMessage}</p>}
                  <button type="submit" className="btn btn-primary" disabled={isSubmittingRequest}>
                    {isSubmittingRequest ? t('loading') : t('submitRequest')}
                  </button>
                </form>

                <div className="worker-request-history">
                  <h4>{t('requestHistory')}</h4>
                  {requests.length === 0 ? (
                    <p className="worker-request-hint">{t('noRequests')}</p>
                  ) : requests.map((item) => (
                    <article className="worker-request-item" key={item.id}>
                      <div>
                        <strong>{item.request_type === 'overtime_pay' ? t('overtimePayRequest') : t('leaveRequest')}</strong>
                        {item.request_type === 'overtime_pay' && (
                          <span> · ₹{Number(item.requested_extra_pay).toLocaleString()}</span>
                        )}
                        {item.request_type === 'leave' && item.leave_date && <span> · {item.leave_date}</span>}
                      </div>
                      <span className={`badge ${item.status === 'approved' ? 'badge-success' : item.status === 'declined' ? 'badge-danger' : 'badge-warning'}`}>
                        {t(`requestStatus_${item.status}`)}
                      </span>
                      <p>{item.reason}</p>
                    </article>
                  ))}
                </div>
              </section>
            )}
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
