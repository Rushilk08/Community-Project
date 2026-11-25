import React, { useState, useEffect } from 'react';
import { getCustomerCancellations, resolveCancellationRequest } from '../../services/api';

export default function CustomerCancellationRequestsSection({ onFindReplacement }) {
  const [cancellations, setCancellations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [resolvingId, setResolvingId] = useState(null);

  const loadCancellations = async () => {
    try {
      setLoading(true);
      const res = await getCustomerCancellations();
      setCancellations(res.cancellations || []);
    } catch (err) {
      setError(err.message || 'Failed to load cancellation requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCancellations();
  }, []);

  const handleDecision = async (cancellationId, decision) => {
    setResolvingId(cancellationId);
    setError('');
    setSuccessMsg('');
    try {
      await resolveCancellationRequest(cancellationId, decision);
      setSuccessMsg(`Cancellation request ${decision}. ${decision === 'approved' ? 'The vacancy has been reopened.' : 'The worker remains committed.'}`);
      loadCancellations();
    } catch (err) {
      setError(err.message || `Failed to ${decision} cancellation.`);
    } finally {
      setResolvingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return <span className="badge badge-success">✓ Cancellation Approved (Vacancy Reopened)</span>;
      case 'rejected':
        return <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>✕ Declined (Worker Retained)</span>;
      default:
        return <span className="badge" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>⏳ Action Required</span>;
    }
  };

  return (
    <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.15rem', color: '#0f172a' }}>
          ⚠️ Job Cancellation Requests ({cancellations.length})
        </h3>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
          Workers must request permission to cancel accepted assignments. You can approve (releasing the vacancy to find a replacement) or reject the request.
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
        <p style={{ color: '#94a3b8' }}>Loading cancellation requests…</p>
      ) : cancellations.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
            No cancellation requests from your workers.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {cancellations.map((c) => {
            const isPending = c.status === 'pending';
            const worker = c.profiles || {};
            const job = c.jobs || {};

            return (
              <div
                key={c.id}
                style={{
                  border: isPending ? '2px solid #ef4444' : '1px solid #e2e8f0',
                  backgroundColor: isPending ? '#fef2f2' : '#f8fafc',
                  borderRadius: '10px',
                  padding: '1.25rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 800 }}>
                        CANCELLATION REQUEST
                      </span>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a' }}>
                        {worker.full_name || 'Assigned Worker'}
                      </h4>
                      {getStatusBadge(c.status)}
                    </div>

                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#334155' }}>
                      Job: <strong>{job.title || 'Worksite Project'}</strong> · Phone: {worker.phone || 'N/A'} · Requested on {new Date(c.created_at).toLocaleString()}
                    </p>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#b91c1c', fontWeight: 600 }}>
                      Reason: {c.reason}
                    </p>
                    {c.explanation && (
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
                        Worker explanation: "{c.explanation}"
                      </p>
                    )}
                  </div>

                  {c.status === 'approved' && onFindReplacement && (
                    <button
                      type="button"
                      onClick={() => onFindReplacement({
                        job_id: c.job_id,
                        worker_id: c.worker_id,
                        booking_id: c.booking_id,
                        date: job.job_date,
                        skill: worker.skill,
                        title: job.title
                      })}
                      className="btn btn-sm btn-primary"
                      style={{ backgroundColor: '#2563eb', borderColor: '#1d4ed8' }}
                    >
                      ⚡ Reopen & Find Replacement
                    </button>
                  )}
                </div>

                {isPending && (
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid #fecaca', paddingTop: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => handleDecision(c.id, 'approved')}
                      disabled={resolvingId === c.id}
                      className="btn btn-sm btn-primary"
                      style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c' }}
                    >
                      {resolvingId === c.id ? 'Processing…' : '✓ Approve Cancellation & Reopen Vacancy'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecision(c.id, 'rejected')}
                      disabled={resolvingId === c.id}
                      className="btn btn-sm btn-outline"
                    >
                      ✕ Reject Cancellation (Keep Worker Committed)
                    </button>
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
