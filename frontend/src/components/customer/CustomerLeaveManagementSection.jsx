import React, { useState, useEffect } from 'react';
import { getCustomerLeaves, resolveLeaveRequest } from '../../services/api';

export default function CustomerLeaveManagementSection({ onFindReplacement }) {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [resolvingId, setResolvingId] = useState(null);
  const [reviewNote, setReviewNote] = useState('');

  const loadLeaves = async () => {
    try {
      setLoading(true);
      const res = await getCustomerLeaves();
      setLeaves(res.leaves || []);
    } catch (err) {
      setError(err.message || 'Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaves();
  }, []);

  const handleDecision = async (leaveId, decision) => {
    setResolvingId(leaveId);
    setError('');
    setSuccessMsg('');

    try {
      await resolveLeaveRequest(leaveId, decision, reviewNote.trim());
      setSuccessMsg(`Leave request has been ${decision}.`);
      setReviewNote('');
      loadLeaves();
    } catch (err) {
      setError(err.message || `Failed to ${decision} leave request.`);
    } finally {
      setResolvingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return <span className="badge badge-success">✓ Approved</span>;
      case 'rejected':
        return <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>✕ Declined</span>;
      default:
        return <span className="badge" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>⏳ Awaiting Decision</span>;
    }
  };

  return (
    <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.15rem', color: '#0f172a' }}>
          🏖️ Worker Leave Management ({leaves.length})
        </h3>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
          Review and approve worker leave requests. When you approve leave, you can immediately find a verified replacement worker.
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

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Loading leave requests…</p>
      ) : leaves.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
            No leave requests from your workers.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {leaves.map((l) => {
            const isPending = l.status === 'pending';
            const worker = l.profiles || {};
            const job = l.jobs || {};

            return (
              <div
                key={l.id}
                style={{
                  border: isPending ? (l.is_emergency ? '2px solid #ea580c' : '2px solid #f59e0b') : '1px solid #e2e8f0',
                  backgroundColor: l.is_emergency ? '#fff7ed' : isPending ? '#fffbeb' : '#f8fafc',
                  borderRadius: '10px',
                  padding: '1.25rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {l.is_emergency && (
                        <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#b91c1c', fontWeight: 800 }}>
                          🚨 URGENT EMERGENCY LEAVE
                        </span>
                      )}
                      <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a' }}>
                        {worker.full_name || 'Assigned Worker'}
                      </h4>
                      {getStatusBadge(l.status)}
                    </div>

                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#334155' }}>
                      Job: <strong>{job.title || 'Worksite Project'}</strong> · Trade: {worker.skill || 'Worker'} · Phone: {worker.phone || 'Available in booking'}
                    </p>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#475569' }}>
                      Leave Dates: <strong>{l.start_date === l.end_date ? l.start_date : `${l.start_date} to ${l.end_date}`}</strong>
                    </p>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#b91c1c', fontWeight: 600 }}>
                      Reason: {l.reason}
                    </p>
                    {l.description && (
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
                        Worker note: "{l.description}"
                      </p>
                    )}
                  </div>

                  {l.status === 'approved' && onFindReplacement && (
                    <button
                      type="button"
                      onClick={() => onFindReplacement({
                        job_id: l.job_id,
                        worker_id: l.worker_id,
                        booking_id: l.booking_id,
                        date: l.start_date,
                        skill: worker.skill || job.required_skill,
                        title: job.title
                      })}
                      className="btn btn-sm btn-primary"
                      style={{ backgroundColor: '#2563eb', borderColor: '#1d4ed8' }}
                    >
                      ⚡ Find Emergency Replacement
                    </button>
                  )}
                </div>

                {isPending && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid #fde68a', paddingTop: '0.75rem' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={resolvingId === l.id ? reviewNote : ''}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="Optional response note to worker..."
                      style={{ marginBottom: '0.5rem', width: '100%', fontSize: '0.825rem' }}
                    />
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => handleDecision(l.id, 'approved')}
                        disabled={resolvingId === l.id}
                        className="btn btn-sm btn-primary"
                        style={{ backgroundColor: '#16a34a', borderColor: '#15803d' }}
                      >
                        ✓ Approve Leave
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDecision(l.id, 'rejected')}
                        disabled={resolvingId === l.id}
                        className="btn btn-sm btn-outline"
                      >
                        ✕ Decline Leave
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
