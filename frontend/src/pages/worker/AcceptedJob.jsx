import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createWorkerRequest, getBookingRequests, getWorkerBookings, pledgeWorkerTeam } from '../../services/api';
import ReferCoworkersModal from '../../components/worker/ReferCoworkersModal';
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
  const [isReferModalOpen, setIsReferModalOpen] = useState(false);
  const [markedTeamReady, setMarkedTeamReady] = useState(true);
  const [isPledging, setIsPledging] = useState(false);
  const [teamPledgedSuccess, setTeamPledgedSuccess] = useState(false);

  const fetchBooking = async () => {
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
  };

  useEffect(() => {
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

  const totalNeeded = Number(booking?.workers_needed || 1);
  const confirmed = Number(booking?.confirmed_workers || 1);
  const remainingVacancies = Number(booking?.remaining_vacancies ?? Math.max(0, totalNeeded - confirmed));

  const handleNavigate = () => {
    if (booking?.location) {
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.location)}`;
      window.open(mapsUrl, '_blank');
    }
  };

  const handleQuickPledge = async () => {
    if (!booking?.job_id && !booking?.id) return;
    setIsPledging(true);
    try {
      await pledgeWorkerTeam({
        job_id: booking.job_id || booking.id,
        remaining_count: remainingVacancies
      });
      setTeamPledgedSuccess(true);
      fetchBooking();
    } catch (err) {
      alert(err.message || 'Failed to confirm team.');
    } finally {
      setIsPledging(false);
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

            {/* Team Vacancies Banner - Mark Box Flow */}
            {remainingVacancies > 0 && (
              <div
                style={{
                  background: 'linear-gradient(135deg, #eff6ff 0%, #ecfdf5 100%)',
                  border: '1.5px dashed #16a34a',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  marginBottom: '1.5rem',
                  boxShadow: '0 4px 12px rgba(22, 163, 74, 0.08)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      backgroundColor: '#dcfce7',
                      color: '#15803d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem',
                      flexShrink: 0
                    }}
                  >
                    👥
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          backgroundColor: '#dcfce7',
                          color: '#15803d',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          textTransform: 'uppercase'
                        }}
                      >
                        Team Vacancies Open
                      </span>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#14532d', fontWeight: 700 }}>
                        {remainingVacancies} More Worker{remainingVacancies > 1 ? 's' : ''} Needed for this Job!
                      </h4>
                    </div>
                    <p style={{ margin: '0.35rem 0 0.75rem', fontSize: '0.875rem', color: '#475569', lineHeight: 1.45 }}>
                      The customer posted this job for <strong>{totalNeeded} workers</strong> ({confirmed} confirmed, <strong>{remainingVacancies} open</strong>).
                    </p>

                    {teamPledgedSuccess || booking?.has_team_pledged ? (
                      <div
                        style={{
                          backgroundColor: '#f0fdf4',
                          border: '1.5px solid #22c55e',
                          borderRadius: '8px',
                          padding: '0.65rem 0.85rem',
                          color: '#15803d',
                          fontSize: '0.88rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        <span>✅</span>
                        <span>
                          <strong>Team Confirmed!</strong> You marked that you have the remaining {remainingVacancies} worker(s) ready and will bring them with you to the worksite.
                        </span>
                      </div>
                    ) : (
                      <div>
                        {/* The Worker Checkbox: "I have remaining person is there for this work" */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.65rem',
                            backgroundColor: markedTeamReady ? '#f0fdf4' : '#ffffff',
                            border: markedTeamReady ? '2px solid #16a34a' : '1.5px solid #cbd5e1',
                            borderRadius: '8px',
                            padding: '0.75rem 0.9rem',
                            marginBottom: '0.75rem',
                            cursor: 'pointer'
                          }}
                          onClick={() => setMarkedTeamReady(!markedTeamReady)}
                        >
                          <input
                            type="checkbox"
                            id="accepted-team-check"
                            checked={markedTeamReady}
                            onChange={(e) => setMarkedTeamReady(e.target.checked)}
                            style={{ width: '22px', height: '22px', accentColor: '#16a34a', cursor: 'pointer', flexShrink: 0 }}
                          />
                          <label
                            htmlFor="accepted-team-check"
                            style={{
                              fontSize: '0.95rem',
                              fontWeight: 700,
                              color: markedTeamReady ? '#14532d' : '#0f172a',
                              cursor: 'pointer',
                              margin: 0
                            }}
                          >
                            I have the remaining {remainingVacancies} person{remainingVacancies > 1 ? 's' : ''} is there for this work (I will bring them)
                          </label>
                        </div>

                        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={handleQuickPledge}
                            disabled={!markedTeamReady || isPledging}
                            className="btn btn-primary"
                            style={{
                              backgroundColor: '#16a34a',
                              borderColor: '#15803d',
                              fontWeight: 700,
                              padding: '0.55rem 1.25rem',
                              borderRadius: '8px',
                              boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)',
                              cursor: (!markedTeamReady || isPledging) ? 'not-allowed' : 'pointer',
                              opacity: !markedTeamReady ? 0.6 : 1
                            }}
                          >
                            {isPledging ? 'Confirming...' : `✅ Confirm I Will Bring ${remainingVacancies} Coworkers`}
                          </button>

                          <button
                            type="button"
                            onClick={() => setIsReferModalOpen(true)}
                            className="btn btn-outline btn-sm"
                            style={{ fontSize: '0.8rem', color: '#475569' }}
                          >
                            More Options / Details
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

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

      {/* Refer Coworkers Modal for Multi-Worker Jobs */}
      {booking && (
        <ReferCoworkersModal
          isOpen={isReferModalOpen}
          job={booking}
          onClose={() => setIsReferModalOpen(false)}
          onSuccess={() => {
            fetchBooking();
          }}
        />
      )}
    </div>
  );
}
