import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useJobStatus from '../../hooks/useJobStatus';
import { cancelJob, getJobWorkerRequests, resolveWorkerRequest } from '../../services/api';
import Loading from '../../components/Loading';
import ErrorMessage from '../../components/ErrorMessage';

export default function LiveHiring() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('jobId') || 'job-101';
  const navigate = useNavigate();
  const [approvedWorkerIds, setApprovedWorkerIds] = useState(new Set());
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [workerRequests, setWorkerRequests] = useState([]);
  const [workerRequestsError, setWorkerRequestsError] = useState('');
  const [resolvingRequestId, setResolvingRequestId] = useState(null);

  const { jobStatus, loading, error, isPolling, isLive, stopPolling, refresh } = useJobStatus(jobId);

  const isCancelled = jobStatus?.status === 'cancelled' || cancelSuccess;

  const loadWorkerRequests = useCallback(async () => {
    try {
      const response = await getJobWorkerRequests(jobId);
      setWorkerRequests(Array.isArray(response?.requests) ? response.requests : []);
      setWorkerRequestsError('');
    } catch (requestError) {
      setWorkerRequestsError(requestError.message || 'Could not load worker requests.');
    }
  }, [jobId]);

  useEffect(() => {
    if (isCancelled) return undefined;

    loadWorkerRequests();
    const timer = window.setInterval(loadWorkerRequests, 15000);
    return () => window.clearInterval(timer);
  }, [isCancelled, loadWorkerRequests]);

  const handleRequestDecision = async (requestId, decision) => {
    setResolvingRequestId(requestId);
    setWorkerRequestsError('');
    try {
      const response = await resolveWorkerRequest(requestId, decision);
      setWorkerRequests((current) => current.map((item) => (
        item.id === requestId ? { ...item, ...response.request } : item
      )));
    } catch (requestError) {
      setWorkerRequestsError(requestError.message || 'Could not update the worker request.');
    } finally {
      setResolvingRequestId(null);
    }
  };

  const handleCancelJob = async () => {
    if (!window.confirm('Are you sure you want to cancel this job? Live hiring will stop immediately and all offers will be withdrawn.')) {
      return;
    }
    setIsCancelling(true);
    try {
      stopPolling();
      await cancelJob(jobId);
      setCancelSuccess(true);
      setTimeout(() => {
        navigate('/customer/dashboard');
      }, 1000);
    } catch (err) {
      alert(err.message || 'Failed to cancel job');
      setIsCancelling(false);
    }
  };

  const toggleApproval = (workerId) => {
    setApprovedWorkerIds((prev) => {
      const next = new Set(prev);
      if (next.has(workerId)) {
        next.delete(workerId);
      } else {
        next.add(workerId);
      }
      return next;
    });
  };

  return (
    <div>
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 className="card-title">{t('liveHiring')}</h2>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
              Job ID: <code>{jobId}</code>
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {!isCancelled ? (
              <button
                type="button"
                onClick={handleCancelJob}
                disabled={isCancelling}
                className="btn btn-outline btn-sm"
                style={{ color: '#dc2626', borderColor: '#fca5a5', fontWeight: 600 }}
              >
                {isCancelling ? 'Cancelling...' : '❌ Cancel Job'}
              </button>
            ) : (
              <span className="badge badge-error" style={{ backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', fontWeight: 700 }}>
                Cancelled
              </span>
            )}

            {isCancelled ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  color: '#dc2626',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  backgroundColor: '#fef2f2',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '20px',
                  border: '1px solid #fecaca'
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#dc2626', display: 'inline-block' }} />
                <span>Live Hiring Stopped</span>
              </div>
            ) : (
              <div className="live-indicator">
                <span className="live-dot" />
                <span>{t('pollingActive')}</span>
              </div>
            )}

            {!isCancelled && (
              <button onClick={refresh} className="btn btn-outline btn-sm">
                🔄 {isPolling ? t('loading') : 'Refresh'}
              </button>
            )}
          </div>
        </div>

        {error && !isCancelled && <ErrorMessage message={error} onRetry={refresh} />}

        {loading && !jobStatus ? (
          <Loading message="Fetching live hiring status..." />
        ) : isCancelled ? (
          /* Live Hiring Stopped State */
          <div
            style={{
              backgroundColor: '#fff',
              border: '2px dashed #f87171',
              borderRadius: '16px',
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              margin: '1rem 0 1.5rem 0',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.05)'
            }}
          >
            <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem' }}>🛑</div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#991b1b', marginBottom: '0.5rem' }}>
              Live Hiring Has Stopped
            </h3>
            <p style={{ color: '#475569', fontSize: '0.95rem', maxWidth: '520px', margin: '0 auto 1.25rem auto', lineHeight: 1.5 }}>
              This job was cancelled. All worker notification dispatches have been immediately withdrawn and live matching has ended. No workers can accept this job.
            </p>

            <div
              style={{
                display: 'inline-flex',
                gap: '0.6rem',
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                padding: '0.4rem 1rem',
                borderRadius: '20px',
                fontSize: '0.85rem',
                fontWeight: 600,
                marginBottom: '2rem'
              }}
            >
              <span>Job ID: {jobId}</span>
              <span>•</span>
              <span>Status: Cancelled</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <Link to="/customer/post-job" className="btn btn-primary" style={{ fontWeight: 600, padding: '0.65rem 1.5rem' }}>
                ➕ Post Another Job
              </Link>
              <Link to="/customer/dashboard" className="btn btn-outline" style={{ fontWeight: 600, padding: '0.65rem 1.5rem' }}>
                &larr; Back to Dashboard
              </Link>
              <Link to="/customer/my-jobs" className="btn btn-outline" style={{ fontWeight: 600, padding: '0.65rem 1.5rem' }}>
                View All Jobs
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="card" style={{ marginBottom: 0, backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }}>
                <span style={{ fontSize: '0.85rem', color: '#1e40af', fontWeight: 600 }}>{t('workersRequired')}</span>
                <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1e3a8a', marginTop: '0.25rem' }}>
                  {jobStatus?.workers_required ?? 1}
                </p>
              </div>

              <div className="card" style={{ marginBottom: 0, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
                <span style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>{t('confirmedWorkers')}</span>
                <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#14532d', marginTop: '0.25rem' }}>
                  {jobStatus?.confirmed_workers ?? 0}
                </p>
              </div>

              <div className="card" style={{ marginBottom: 0, backgroundColor: '#fefce8', borderColor: '#fef08a' }}>
                <span style={{ fontSize: '0.85rem', color: '#ca8a04', fontWeight: 600 }}>{t('pendingRequests')}</span>
                <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#713f12', marginTop: '0.25rem' }}>
                  {jobStatus?.pending_requests ?? 0}
                </p>
              </div>
            </div>

            {/* Workers Experience & Review Section */}
            <div className="card">
              <h3 style={{ fontSize: '1.15rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>👷</span>
                <span>Worker Responses &amp; Experience Review</span>
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Review workers who accepted your job offer, inspect their experience and ratings, and confirm their site access.
              </p>

              {jobStatus?.accepted_workers?.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {jobStatus.accepted_workers.map((worker) => {
                    const isApproved = approvedWorkerIds.has(worker.id);
                    return (
                      <div
                        key={worker.id}
                        style={{
                          border: isApproved ? '2px solid #22c55e' : '1px solid #e2e8f0',
                          borderRadius: '12px',
                          padding: '1.25rem',
                          backgroundColor: isApproved ? '#f0fdf4' : '#ffffff',
                          transition: 'all 0.2s ease',
                          animation: 'slideInLeft 0.45s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <div
                              style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                backgroundColor: '#1e40af',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.25rem',
                                fontWeight: 700
                              }}
                            >
                              {worker.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{worker.name}</h4>
                                {worker.is_new ? (
                                  <span
                                    className="badge"
                                    style={{
                                      backgroundColor: '#fef3c7',
                                      color: '#92400e',
                                      border: '1px solid #fde68a',
                                      fontSize: '0.72rem',
                                      fontWeight: 700
                                    }}
                                  >
                                    🌱 New Worker
                                  </span>
                                ) : (
                                  <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                                    ⭐ Experienced
                                  </span>
                                )}
                                <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                                  ✓ ID Verified
                                </span>
                              </div>
                              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                Trade: <strong>{worker.skill}</strong>
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#15803d' }}>
                              ₹{worker.agreed_wage || 850} / day
                            </span>
                            {isApproved ? (
                              <span className="badge badge-success" style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}>
                                ✅ Confirmed &amp; Approved
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggleApproval(worker.id)}
                                className="btn btn-primary btn-sm"
                                style={{ backgroundColor: '#16a34a', borderColor: '#15803d', fontWeight: 700 }}
                              >
                                👍 Confirm &amp; Approve Hire
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Real Experience & Quality Metrics */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                            gap: '0.75rem',
                            marginTop: '1rem',
                            padding: '0.75rem',
                            backgroundColor: '#f8fafc',
                            borderRadius: '8px',
                            border: '1px solid #f1f5f9'
                          }}
                        >
                          <div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Rating &amp; Reviews</span>
                            <strong style={{ color: worker.is_new ? '#0284c7' : '#b45309' }}>
                              {worker.is_new ? '🌱 New (No ratings yet)' : `⭐ ${worker.rating} (${worker.reviews_count} Reviews)`}
                            </strong>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Field Experience</span>
                            <strong style={{ color: '#1e3a8a' }}>
                              {worker.is_new ? 'First Assignment' : (worker.experience_years || '1+ Year')}
                            </strong>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Punctuality</span>
                            <strong style={{ color: '#15803d' }}>
                              {worker.punctuality_rate || '100% Ready'}
                            </strong>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Completed Jobs</span>
                            <strong style={{ color: '#475569' }}>
                              {worker.jobs_completed > 0 ? `📋 ${worker.jobs_completed} Tasks Done` : '0 Tasks (New Worker)'}
                            </strong>
                          </div>
                        </div>

                        <p style={{ margin: '0.75rem 0 0.5rem 0', fontSize: '0.875rem', color: '#475569' }}>
                          <em>"{worker.bio || (worker.is_new ? 'New verified worker ready for their first work opportunity on WorkLink.' : `Experienced in ${worker.skill} work with verified job completions.`)}"</em>
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                            📞 Contact: <strong style={{ color: '#1e293b' }}>{worker.phone}</strong>
                          </span>
                          <a href={`tel:${worker.phone}`} className="btn btn-outline btn-sm">
                            📞 Call Worker
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
                    ⏳ Waiting for nearby workers to accept dispatched offers...
                  </p>
                </div>
              )}
            </div>

            <section className="customer-worker-requests card" aria-labelledby="customer-worker-requests-heading">
              <div className="customer-worker-requests-header">
                <div>
                  <h3 id="customer-worker-requests-heading">{t('customerRequestsTitle')}</h3>
                  <p>{t('customerRequestsHint')}</p>
                </div>
                <button type="button" className="btn btn-outline btn-sm" onClick={loadWorkerRequests}>
                  Refresh
                </button>
              </div>

              {workerRequestsError && (
                <p className="worker-request-error" role="alert">{workerRequestsError}</p>
              )}
              {workerRequests.length === 0 ? (
                <p className="worker-request-hint">{t('noRequests')}</p>
              ) : (
                <div className="customer-worker-requests-list">
                  {workerRequests.map((workerRequest) => (
                    <article className="worker-request-item" key={workerRequest.id}>
                      <div className="customer-worker-request-title">
                        <div>
                          <strong>{workerRequest.worker_name}</strong>
                          <span>{workerRequest.request_type === 'overtime_pay' ? t('overtimePayRequest') : t('leaveRequest')}</span>
                        </div>
                        <span className={`badge ${workerRequest.status === 'approved' ? 'badge-success' : workerRequest.status === 'declined' ? 'badge-danger' : 'badge-warning'}`}>
                          {t(`requestStatus_${workerRequest.status}`)}
                        </span>
                      </div>
                      {workerRequest.request_type === 'overtime_pay' ? (
                        <p className="customer-worker-request-amount">
                          {t('requestExtraAmount')}: ₹{Number(workerRequest.requested_extra_pay).toLocaleString()}
                        </p>
                      ) : (
                        <p className="customer-worker-request-amount">
                          {t('leaveDateForBooking')}: {workerRequest.leave_date || '—'}
                        </p>
                      )}
                      <p>{workerRequest.reason}</p>
                      {workerRequest.status === 'pending' && (
                        <div className="customer-worker-request-actions">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={resolvingRequestId === workerRequest.id}
                            onClick={() => handleRequestDecision(workerRequest.id, 'approve')}
                          >
                            {t('approveRequest')}
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            disabled={resolvingRequestId === workerRequest.id}
                            onClick={() => handleRequestDecision(workerRequest.id, 'decline')}
                          >
                            {t('declineRequest')}
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <Link to={`/customer/confirmed-workers?jobId=${jobId}`} className="btn btn-primary">
                {t('confirmedWorkers')}
              </Link>
              <Link to="/customer/my-jobs" className="btn btn-outline">
                {t('myJobs')}
              </Link>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInLeft {
          0% {
            opacity: 0;
            transform: translateX(-40px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
