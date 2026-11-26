import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { requestJobCancellation, getMyCancellations, getWorkerBookings } from '../../services/api';

export default function WorkerCancellationSection() {
  const { t, i18n } = useTranslation();
  const [bookings, setBookings] = useState([]);
  const [cancellations, setCancellations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [reason, setReason] = useState('Medical reasons / Illness');
  const [customReason, setCustomReason] = useState('');
  const [explanation, setExplanation] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  const formatDateTime = (isoStr) => {
    if (!isoStr) return '';
    try {
      const currentLang = i18n.language ? i18n.language.split('-')[0] : 'en';
      const locale = currentLang === 'kn' ? 'kn-IN' : currentLang === 'hi' ? 'hi-IN' : 'en-IN';
      return new Date(isoStr).toLocaleString(locale, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return isoStr;
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [bookingsRes, cancRes] = await Promise.all([
        getWorkerBookings().catch(() => ({ bookings: [] })),
        getMyCancellations().catch(() => ({ cancellations: [] }))
      ]);
      const activeBookings = (bookingsRes.bookings || []).filter(
        (b) => b.status === 'confirmed' || b.status === 'in_progress'
      );
      setBookings(activeBookings);
      setCancellations(cancRes.cancellations || []);
      if (activeBookings.length > 0 && !selectedBookingId) {
        setSelectedBookingId(activeBookings[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load cancellation records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!selectedBookingId) {
      setError(t('selectAcceptedJob', 'Please select an active accepted job.'));
      return;
    }
    const effectiveReason = reason === 'Other' ? customReason.trim() : reason;
    if (!effectiveReason) {
      setError(t('reasonCancellation', 'Please provide a reason for cancellation.'));
      return;
    }
    if (!acknowledged) {
      setError(t('cancellationAckText', 'You must confirm that you understand the customer must approve this request.'));
      return;
    }

    setSubmitting(true);
    try {
      await requestJobCancellation({
        booking_id: selectedBookingId,
        reason: effectiveReason,
        explanation: explanation.trim(),
        acknowledged_approval_required: true
      });
      setSuccessMsg(t('requestSent', 'Cancellation request submitted to customer. Your schedule remains committed until approved.'));
      setExplanation('');
      setAcknowledged(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to submit cancellation request.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status, resolvedAt, createdAt) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return (
          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.15rem' }}>
            <span className="badge badge-success">✓ {t('cancellationApprovedBadge', 'Cancellation Approved (Slot Released)')}</span>
            {resolvedAt && (
              <small style={{ color: '#15803d', fontSize: '0.725rem', fontWeight: 600 }}>
                {t('cancellationApprovedAt', 'Cancellation approved on')} {formatDateTime(resolvedAt)}
              </small>
            )}
          </div>
        );
      case 'rejected':
        return (
          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.15rem' }}>
            <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
              ✕ {t('cancellationDeclinedBadge', 'Declined by Customer')}
            </span>
            {resolvedAt && (
              <small style={{ color: '#b91c1c', fontSize: '0.725rem', fontWeight: 600 }}>
                {t('cancellationRejectedAt', 'Cancellation rejected on')} {formatDateTime(resolvedAt)}
              </small>
            )}
          </div>
        );
      default:
        return (
          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.15rem' }}>
            <span className="badge" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
              ⏳ {t('cancellationPendingBadge', 'Pending Customer Decision')}
            </span>
            {createdAt && (
              <small style={{ color: '#92400e', fontSize: '0.725rem' }}>
                {t('requestedOn', 'Requested on')} {formatDateTime(createdAt)}
              </small>
            )}
          </div>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Cancellation Request Form */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.15rem', color: '#0f172a' }}>
            ⚠️ {t('cancellationTitle', 'Request Job Cancellation (Customer Confirmation Required)')}
          </h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            {t('cancellationSubtitle', 'To protect employers and maintain trust, workers cannot unilaterally cancel an accepted job. The customer must approve the request before your commitment is released.')}
          </p>
        </div>

        {error && (
          <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}
        {successMsg && (
          <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#15803d', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {successMsg}
          </div>
        )}

        {bookings.length === 0 ? (
          <div style={{ padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
              You do not have any active accepted jobs to cancel.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                {t('selectAcceptedJob', 'Select Accepted Job *')}
              </label>
              <select
                value={selectedBookingId}
                onChange={(e) => setSelectedBookingId(e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
                required
              >
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title || 'Worksite Job'} · ₹{b.wage || b.agreed_wage}/day ({b.location || 'Site'})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                {t('reasonCancellation', 'Reason for Requesting Cancellation *')}
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
              >
                <option value="Medical reasons / Illness">Medical reasons / Illness</option>
                <option value="Unavoidable family emergency">Unavoidable family emergency</option>
                <option value="Transportation breakdown">Transportation breakdown</option>
                <option value="Conflicting severe circumstance">Conflicting severe circumstance</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {reason === 'Other' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <input
                  type="text"
                  className="form-input"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Specify reason..."
                  required
                />
              </div>
            )}

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                {t('explanationOptional', 'Explanation for the Customer (Optional)')}
              </label>
              <textarea
                className="form-input"
                rows={2}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder={t('explanationPlaceholder', 'Explain the situation politely to the customer...')}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#1e293b' }}>
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  style={{ marginTop: '3px' }}
                  required
                />
                <span>
                  <strong>{t('cancellationAckText', 'I understand: This job commitment remains active and I cannot accept overlapping jobs until the customer explicitly approves this cancellation request.')}</strong>
                </span>
              </label>
            </div>

            <div style={{ gridColumn: '1 / -1', marginTop: '0.25rem' }}>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c', padding: '0.65rem 1.5rem' }}
              >
                {submitting ? t('submittingCancellation', 'Submitting Cancellation Request…') : `${t('submitCancellation', 'Submit Cancellation Request')} ➔`}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Cancellation History */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1.15rem', color: '#0f172a' }}>
          📑 {t('myCancellations', 'My Cancellation Requests')} ({cancellations.length})
        </h3>

        {loading ? (
          <p style={{ color: '#94a3b8' }}>{t('loading', 'Loading…')}</p>
        ) : cancellations.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
              {t('noCancellations', 'No cancellation requests submitted.')}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {cancellations.map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  border: '1px solid #f1f5f9',
                  borderRadius: '8px',
                  backgroundColor: '#f8fafc',
                  flexWrap: 'wrap',
                  gap: '0.75rem'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <strong style={{ color: '#1e293b', fontSize: '0.95rem' }}>
                      {c.jobs?.title || 'Job Booking'}
                    </strong>
                    {getStatusBadge(c.status, c.resolved_at, c.created_at)}
                  </div>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.825rem', color: '#475569' }}>
                    {t('reasonCancellation', 'Reason')}: <strong>{c.reason}</strong> · {t('requestedOn', 'Requested on')} {formatDateTime(c.created_at)}
                  </p>
                  {c.explanation && (
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.775rem', color: '#64748b' }}>
                      Note: "{c.explanation}"
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
