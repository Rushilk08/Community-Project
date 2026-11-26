import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { applyForLeave, getMyLeaves, cancelMyLeave, getWorkerBookings } from '../../services/api';

export default function WorkerLeaveSection() {
  const { t, i18n } = useTranslation();
  const [bookings, setBookings] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('Personal / Family Emergency');
  const [customReason, setCustomReason] = useState('');
  const [description, setDescription] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);

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
      const [bookingsRes, leavesRes] = await Promise.all([
        getWorkerBookings().catch(() => ({ bookings: [] })),
        getMyLeaves().catch(() => ({ leaves: [] }))
      ]);
      const activeBookings = (bookingsRes.bookings || []).filter(
        (b) => b.status === 'confirmed' || b.status === 'in_progress'
      );
      setBookings(activeBookings);
      setLeaves(leavesRes.leaves || []);
      if (activeBookings.length > 0 && !selectedBookingId) {
        setSelectedBookingId(activeBookings[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load leave records');
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
      setError(t('selectActiveJob', 'Please select the active job for which you need leave.'));
      return;
    }
    if (!startDate) {
      setError(t('startDate', 'Start date is required.'));
      return;
    }

    const selectedBooking = bookings.find((b) => b.id === selectedBookingId);
    const effectiveReason = reason === 'Other' ? customReason.trim() : reason;

    if (!effectiveReason) {
      setError(t('reasonForLeave', 'Please provide a reason for the leave.'));
      return;
    }

    setSubmitting(true);
    try {
      await applyForLeave({
        job_id: selectedBooking?.job_id,
        booking_id: selectedBookingId,
        start_date: startDate,
        end_date: endDate || startDate,
        reason: effectiveReason,
        description: description.trim(),
        is_emergency: isEmergency
      });
      setSuccessMsg(t('requestSent', 'Leave application submitted successfully! Your employer has been notified.'));
      setStartDate('');
      setEndDate('');
      setDescription('');
      setIsEmergency(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to apply for leave.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (leaveId, isApproved = false) => {
    const confirmPrompt = isApproved
      ? t('confirmCancelApprovedLeave', 'Are you sure you want to cancel this approved leave and return to active work?')
      : t('confirmCancelPendingLeave', 'Cancel this pending leave request?');
    if (!window.confirm(confirmPrompt)) return;
    try {
      await cancelMyLeave(leaveId);
      setSuccessMsg(t('leaveCancelledSuccess', 'Leave cancelled successfully. You are now available for work.'));
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to cancel leave.');
    }
  };

  const getStatusBadge = (status, reviewedAt, createdAt) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return (
          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.15rem' }}>
            <span className="badge badge-success">✓ {t('leaveApprovedBadge', 'Approved')}</span>
            {reviewedAt && (
              <small style={{ color: '#15803d', fontSize: '0.725rem', fontWeight: 600 }}>
                {t('leaveApprovedAt', 'Customer gave leave on')} {formatDateTime(reviewedAt)}
              </small>
            )}
          </div>
        );
      case 'rejected':
        return (
          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.15rem' }}>
            <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
              ✕ {t('leaveDeclinedBadge', 'Declined')}
            </span>
            {reviewedAt && (
              <small style={{ color: '#b91c1c', fontSize: '0.725rem', fontWeight: 600 }}>
                {t('leaveDeniedAt', 'Leave denied on')} {formatDateTime(reviewedAt)}
              </small>
            )}
          </div>
        );
      case 'cancelled':
        return <span className="badge badge-neutral">{t('cancelled', 'Cancelled')}</span>;
      default:
        return (
          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.15rem' }}>
            <span className="badge" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
              ⏳ {t('leavePendingBadge', 'Pending Decision')}
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
      {/* Leave Application Form */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.15rem', color: '#0f172a' }}>
            🏖️ {t('workerLeaveTitle', 'Worker Leave Application')}
          </h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            {t('workerLeaveSubtitle', 'Need time off for personal reasons or emergencies? Submit your leave request transparently to your employer.')}
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
              You do not have any active confirmed jobs to request leave for.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                {t('selectActiveJob', 'Select Active Job Assignment *')}
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

            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                {t('startDate', 'Start Date *')}
              </label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                {t('endDateOptional', 'End Date (Optional for multi-day leave)')}
              </label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="Same as start date if single day"
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                {t('reasonForLeave', 'Reason for Leave *')}
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
              >
                <option value="Personal / Family Emergency">Personal / Family Emergency</option>
                <option value="Health / Medical Illness">Health / Medical Illness</option>
                <option value="Festival / Religious Commitment">Festival / Religious Commitment</option>
                <option value="Transportation / Travel Issues">Transportation / Travel Issues</option>
                <option value="Other">Other Reason</option>
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
                {t('explanationOptional', 'Additional Details (Optional)')}
              </label>
              <textarea
                className="form-input"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('leaveDescPlaceholder', 'Explain briefly to help your employer plan arrangements...')}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#b91c1c', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={isEmergency}
                  onChange={(e) => setIsEmergency(e.target.checked)}
                />
                <span>{t('emergencyLeaveCheckbox', '🚨 This is an urgent / emergency leave request (alert employer immediately)')}</span>
              </label>
            </div>

            <div style={{ gridColumn: '1 / -1', marginTop: '0.25rem' }}>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                style={{ padding: '0.65rem 1.5rem' }}
              >
                {submitting ? t('submittingLeave', 'Submitting Leave Request…') : `${t('applyLeaveBtn', 'Submit Leave Request')} ➔`}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Leave Applications History */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1.15rem', color: '#0f172a' }}>
          📅 {t('myLeaveApplications', 'My Leave Applications')} ({leaves.length})
        </h3>

        {loading ? (
          <p style={{ color: '#94a3b8' }}>{t('loading', 'Loading leave history…')}</p>
        ) : leaves.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
              {t('noLeaves', "You haven't requested any leave yet.")}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {leaves.map((l) => (
              <div
                key={l.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  border: '1px solid #f1f5f9',
                  borderRadius: '8px',
                  backgroundColor: l.is_emergency ? '#fff7ed' : '#f8fafc',
                  flexWrap: 'wrap',
                  gap: '0.75rem'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <strong style={{ color: '#1e293b', fontSize: '0.95rem' }}>
                      {l.jobs?.title || 'Job Assignment'}
                    </strong>
                    {l.is_emergency && (
                      <span className="badge" style={{ backgroundColor: '#fed7aa', color: '#9a3412', fontSize: '0.7rem' }}>
                        EMERGENCY
                      </span>
                    )}
                    {getStatusBadge(l.status, l.reviewed_at, l.created_at)}
                  </div>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.825rem', color: '#475569' }}>
                    Dates: <strong>{l.start_date === l.end_date ? l.start_date : `${l.start_date} to ${l.end_date}`}</strong> · {t('reasonForLeave', 'Reason')}: {l.reason}
                  </p>
                  {l.review_notes && (
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.775rem', color: '#0369a1', fontStyle: 'italic' }}>
                      Customer note: "{l.review_notes}"
                    </p>
                  )}
                </div>

                {l.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => handleCancel(l.id, false)}
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: '0.75rem', color: '#dc2626', borderColor: '#fca5a5' }}
                  >
                    {t('cancelRequest', 'Cancel Request')}
                  </button>
                )}

                {l.status === 'approved' && (
                  <button
                    type="button"
                    onClick={() => handleCancel(l.id, true)}
                    className="btn btn-outline btn-sm"
                    style={{
                      fontSize: '0.75rem',
                      color: '#dc2626',
                      borderColor: '#fca5a5',
                      fontWeight: 600,
                      backgroundColor: '#ffffff'
                    }}
                  >
                    {t('cancelApprovedLeave', 'Cancel Leave & Return to Work')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
