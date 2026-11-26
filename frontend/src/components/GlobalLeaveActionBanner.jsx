import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  getCustomerLeaves,
  getMyLeaves,
  resolveLeaveRequest,
  getNotifications,
  markNotificationAsRead,
  getCustomerCancellations,
  resolveCancellationRequest,
  getMyCancellations,
  cancelMyLeave
} from '../services/api';
import { playWorkOfferSound } from '../utils/audio';

const DISMISSED_STORAGE_PREFIX = 'worklink_dismissed_actions_';

const loadDismissedIds = (userId) => {
  if (!userId) return new Set();
  try {
    const raw = localStorage.getItem(`${DISMISSED_STORAGE_PREFIX}${userId}`);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set();
};

const saveDismissedIds = (userId, setOrArray) => {
  if (!userId) return;
  try {
    const arr = Array.from(setOrArray);
    localStorage.setItem(`${DISMISSED_STORAGE_PREFIX}${userId}`, JSON.stringify(arr));
  } catch {}
};

export default function GlobalLeaveActionBanner() {
  const { t } = useTranslation();
  const { user, role } = useAuth();
  const navigate = useNavigate();

  // Active item to display (leave or cancellation)
  const [activeItem, setActiveItem] = useState(null);
  const [activeNotificationId, setActiveNotificationId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null); // 'approved' | 'rejected'
  const [reviewNote, setReviewNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [dismissedIds, setDismissedIds] = useState(() => loadDismissedIds(user?.id));
  const dismissedIdsRef = useRef(dismissedIds);
  const [isMinimized, setIsMinimized] = useState(false);
  const prevItemIdRef = useRef(null);

  // Sync dismissedIds with active user id
  useEffect(() => {
    const loaded = loadDismissedIds(user?.id);
    setDismissedIds(loaded);
    dismissedIdsRef.current = loaded;
  }, [user?.id]);

  useEffect(() => {
    dismissedIdsRef.current = dismissedIds;
  }, [dismissedIds]);

  // Poll for action updates
  useEffect(() => {
    if (!user || !role) {
      setActiveItem(null);
      setActiveNotificationId(null);
      return;
    }

    let isMounted = true;

    const checkUpdates = async () => {
      try {
        if (role === 'customer') {
          // Fetch both customer leaves and cancellations in parallel
          const [leavesRes, cancRes] = await Promise.all([
            getCustomerLeaves().catch(() => ({ leaves: [] })),
            getCustomerCancellations().catch(() => ({ cancellations: [] }))
          ]);
          if (!isMounted) return;

          const leaves = leavesRes?.leaves || [];
          const cancellations = cancRes?.cancellations || [];

          // Prioritize cancellation requests first, then leaves
          const pendingCancellation = cancellations.find(
            (c) => c.status === 'pending' && !dismissedIdsRef.current.has(`canc_${c.id}`)
          );
          const pendingLeave = leaves.find(
            (l) => l.status === 'pending' && !dismissedIdsRef.current.has(`leave_${l.id}`)
          );

          const toShow = pendingCancellation
            ? { ...pendingCancellation, requestCategory: 'cancellation' }
            : (pendingLeave ? { ...pendingLeave, requestCategory: 'leave' } : null);

          if (toShow) {
            const key = `${toShow.requestCategory}_${toShow.id}`;
            if (prevItemIdRef.current !== key) {
              prevItemIdRef.current = key;
              try { playWorkOfferSound(); } catch {}
            }
            setActiveItem(toShow);
          } else {
            if (!actionSuccess) {
              setActiveItem(null);
            }
          }
        } else if (role === 'worker') {
          // Check unread notifications first to ensure we ONLY notify ONCE after customer approved/rejected
          const notifRes = await getNotifications({ unread_only: true });
          if (!isMounted) return;
          const unreadNotifs = notifRes?.notifications || [];

          // Find unread notification for leave or cancellation decision
          const actionNotif = unreadNotifs.find((n) => {
            const isLeave = n.type === 'leave';
            const isCanc = n.type === 'cancellation_decision';
            if (!isLeave && !isCanc) return false;

            const notifStatus = n.data?.status;
            const isDecision =
              notifStatus === 'approved' ||
              notifStatus === 'rejected' ||
              (n.title &&
                (n.title.toLowerCase().includes('approved') ||
                  n.title.toLowerCase().includes('declined') ||
                  n.title.toLowerCase().includes('rejected')));
            if (!isDecision) return false;

            const notifId = n.id;
            const refId = n.data?.leave_id || n.data?.cancellation_id;
            if (dismissedIdsRef.current.has(notifId)) return false;
            if (
              refId &&
              (dismissedIdsRef.current.has(refId) ||
                dismissedIdsRef.current.has(`worker_${refId}_${notifStatus || 'approved'}`))
            ) {
              return false;
            }
            return true;
          });

          if (!actionNotif) {
            if (activeNotificationId && !dismissedIdsRef.current.has(activeNotificationId)) {
              setActiveItem(null);
              setActiveNotificationId(null);
            }
            return;
          }

          const isLeave = actionNotif.type === 'leave';
          const targetId = isLeave ? actionNotif.data?.leave_id : actionNotif.data?.cancellation_id;
          let details = null;

          try {
            if (isLeave) {
              const leavesRes = await getMyLeaves();
              if (!isMounted) return;
              const myLeaves = leavesRes?.leaves || [];
              if (targetId) {
                details = myLeaves.find((l) => String(l.id) === String(targetId));
              }
              if (!details && myLeaves.length > 0) {
                details = myLeaves.find((l) => l.status === (actionNotif.data?.status || 'approved'));
              }
            } else {
              const cancRes = await getMyCancellations();
              if (!isMounted) return;
              const myCanc = cancRes?.cancellations || [];
              if (targetId) {
                details = myCanc.find((c) => String(c.id) === String(targetId));
              }
              if (!details && myCanc.length > 0) {
                details = myCanc.find((c) => c.status === (actionNotif.data?.status || 'approved'));
              }
            }
          } catch {
            // fallback
          }

          if (!details) {
            details = {
              id: targetId || actionNotif.id,
              status: actionNotif.data?.status || 'approved',
              reason: actionNotif.data?.reason || actionNotif.message || 'Request Update',
              jobs: { title: actionNotif.data?.job_title || 'Assigned Job' },
              start_date: actionNotif.data?.start_date || '',
              end_date: actionNotif.data?.end_date || ''
            };
          }

          details.requestCategory = isLeave ? 'leave' : 'cancellation';

          if (
            dismissedIdsRef.current.has(details.id) ||
            dismissedIdsRef.current.has(`worker_${details.id}_${details.status}`)
          ) {
            return;
          }

          const itemKey = `${details.requestCategory}_${details.id}_${details.status}`;
          if (prevItemIdRef.current !== itemKey) {
            prevItemIdRef.current = itemKey;
            try { playWorkOfferSound(); } catch {}
          }

          setActiveNotificationId(actionNotif.id);
          setActiveItem(details);
        }
      } catch {
        // Ignore network polling hiccups
      }
    };

    checkUpdates();
    const interval = setInterval(checkUpdates, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user, role, actionSuccess, activeNotificationId]);

  if (!activeItem && !actionSuccess) return null;

  const handleDismiss = async () => {
    const currentNotifId = activeNotificationId;
    const currentItem = activeItem;

    if (currentNotifId) {
      try {
        await markNotificationAsRead(currentNotifId);
        window.dispatchEvent(
          new CustomEvent('worklink:notification-read', { detail: { id: currentNotifId } })
        );
      } catch (err) {
        console.warn('Failed to mark notification as read', err);
      }
    }

    if (currentItem) {
      const keysToAdd = [
        currentItem.id,
        role === 'customer'
          ? `${currentItem.requestCategory === 'cancellation' ? 'canc' : 'leave'}_${currentItem.id}`
          : `worker_${currentItem.id}_${currentItem.status}`,
        currentNotifId
      ].filter(Boolean);

      setDismissedIds((prev) => {
        const next = new Set(prev);
        keysToAdd.forEach((k) => next.add(k));
        saveDismissedIds(user?.id, next);
        dismissedIdsRef.current = next;
        return next;
      });
    }

    setActiveItem(null);
    setActiveNotificationId(null);
    setActionSuccess(null);
    setIsMinimized(false);
  };

  const handleDecision = async (decision) => {
    if (!activeItem) return;
    setActionLoading(true);
    try {
      if (activeItem.requestCategory === 'cancellation') {
        await resolveCancellationRequest(activeItem.id, decision);
      } else {
        await resolveLeaveRequest(activeItem.id, decision, reviewNote.trim());
      }
      setActionSuccess(decision);
      const dismissKey = `${activeItem.requestCategory === 'cancellation' ? 'canc' : 'leave'}_${activeItem.id}`;
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.add(dismissKey);
        next.add(activeItem.id);
        saveDismissedIds(user?.id, next);
        dismissedIdsRef.current = next;
        return next;
      });
    } catch (err) {
      alert(err.message || `Failed to ${decision} request`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleGoToReplacement = () => {
    const job = activeItem?.jobs || {};
    handleDismiss();
    navigate('/customer/dashboard', {
      state: {
        activeTab: 'replacement',
        jobId: job.id,
        skill: job.required_skill || job.skill,
        title: job.title
      }
    });
  };

  const isCancellation = activeItem?.requestCategory === 'cancellation';
  const workerInfo = activeItem?.profiles || {};
  const jobInfo = activeItem?.jobs || {};
  const isEmergency = Boolean(activeItem?.is_emergency);

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 220 }}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          zIndex: 99999,
          backgroundColor: role === 'customer'
            ? (isCancellation ? '#450a0a' : (isEmergency ? '#450a0a' : '#0f172a'))
            : (activeItem?.status === 'approved' ? '#064e3b' : activeItem?.status === 'rejected' ? '#7f1d1d' : '#1e293b'),
          color: '#ffffff',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.45)',
          borderTop: isCancellation
            ? '3px solid #f97316'
            : (isEmergency
              ? '3px solid #ef4444'
              : (activeItem?.status === 'approved' ? '3px solid #10b981' : '3px solid #3b82f6')),
          padding: isMinimized ? '0.6rem 1.5rem' : '1.15rem 1.75rem',
          backdropFilter: 'blur(10px)',
          fontFamily: 'inherit'
        }}
        aria-live="assertive"
        role="alert"
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}
        >
          {/* Header Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap'
            }}
          >
            {/* Left Status Tag */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  backgroundColor: role === 'customer'
                    ? (isCancellation ? '#dc2626' : (isEmergency ? '#dc2626' : '#d97706'))
                    : (activeItem?.status === 'approved' ? '#10b981' : activeItem?.status === 'rejected' ? '#ef4444' : '#64748b'),
                  color: '#ffffff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }}
              >
                {role === 'customer' ? (
                  isCancellation
                    ? `⚠️ ${t('cancellationRequestReceived', 'Job Cancellation Request')}`
                    : (isEmergency ? '🚨 Emergency Leave' : '🏖️ Leave Request')
                ) : (
                  isCancellation
                    ? (activeItem?.status === 'approved' ? `✓ ${t('cancellationApproved', 'Cancellation Approved')}` : `✕ ${t('cancellationDeclined', 'Cancellation Declined')}`)
                    : (activeItem?.status === 'approved'
                      ? `✓ ${t('leaveApproved', 'Leave Approved')}`
                      : activeItem?.status === 'rejected'
                      ? `✕ ${t('leaveDeclined', 'Leave Declined')}`
                      : '⏳ Pending')
                )}
              </span>

              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc' }}>
                {role === 'customer' ? (
                  actionSuccess ? (
                    actionSuccess === 'approved'
                      ? (isCancellation ? '✅ Cancellation Approved!' : '✅ Leave Approved!')
                      : (isCancellation ? '✕ Cancellation Declined.' : '✕ Leave Declined.')
                  ) : (
                    isCancellation ? (
                      <span>Worker <strong>{workerInfo.full_name || 'Assigned Worker'}</strong> requested to cancel job commitment</span>
                    ) : (
                      <span>Worker <strong>{workerInfo.full_name || 'Assigned Worker'}</strong> requested time off</span>
                    )
                  )
                ) : (
                  isCancellation ? (
                    activeItem?.status === 'approved'
                      ? 'Your job cancellation request was approved by your employer. Your schedule is released.'
                      : 'Your job cancellation request was declined by your employer. You remain committed.'
                  ) : (
                    activeItem?.status === 'approved'
                      ? 'Good news! Your leave request has been approved by your employer.'
                      : 'Your leave request was declined by your employer.'
                  )
                )}
              </span>
            </div>

            {/* Right Controls (Minimize & Dismiss) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setIsMinimized(!isMinimized)}
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: 'none',
                  color: '#e2e8f0',
                  borderRadius: '6px',
                  padding: '0.2rem 0.55rem',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                {isMinimized ? 'Expand ▲' : 'Minimize ▼'}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: 'none',
                  color: '#e2e8f0',
                  borderRadius: '6px',
                  padding: '0.2rem 0.55rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Expanded Content Body */}
          {!isMinimized && (
            <div>
              {/* CUSTOMER PORTAL VIEW */}
              {role === 'customer' && (
                <div>
                  {actionSuccess ? (
                    /* Customer After-Decision Success State */
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '1rem',
                        padding: '0.5rem 0'
                      }}
                    >
                      <div>
                        <p style={{ margin: '0 0 0.25rem', fontSize: '0.95rem', color: '#f1f5f9' }}>
                          {actionSuccess === 'approved'
                            ? (isCancellation
                              ? `You approved cancellation for ${workerInfo.full_name || 'the worker'}. The vacancy has been reopened.`
                              : `You approved leave for ${workerInfo.full_name || 'the worker'}. The worker schedule is updated.`)
                            : `You declined the request for ${workerInfo.full_name || 'the worker'}. Worker remains committed.`}
                        </p>
                        {actionSuccess === 'approved' && (
                          <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                            You can now find and dispatch a verified emergency replacement worker so your project remains on schedule.
                          </p>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {actionSuccess === 'approved' && (
                          <button
                            type="button"
                            onClick={handleGoToReplacement}
                            className="btn btn-primary"
                            style={{
                              backgroundColor: '#2563eb',
                              borderColor: '#1d4ed8',
                              color: '#ffffff',
                              fontWeight: 700,
                              padding: '0.45rem 1rem',
                              fontSize: '0.85rem'
                            }}
                          >
                            {t('findEmergencyReplacementNow', '🚨 Find Emergency Replacement Now →')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleDismiss}
                          className="btn btn-outline"
                          style={{
                            color: '#ffffff',
                            borderColor: 'rgba(255,255,255,0.3)',
                            padding: '0.45rem 0.85rem',
                            fontSize: '0.85rem'
                          }}
                        >
                          {t('close', 'Close')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Customer Active Request Review State */
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '1.25rem'
                      }}
                    >
                      {/* Details */}
                      <div style={{ flex: '1 1 360px', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>
                            {workerInfo.full_name || 'Worker'}
                            {workerInfo.phone && <small style={{ fontWeight: 400, color: '#94a3b8', marginLeft: '0.4rem' }}>({workerInfo.phone})</small>}
                          </span>
                          <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>
                            Job: <strong>{jobInfo.title || 'Your Active Job'}</strong>
                          </span>
                          {!isCancellation && activeItem.start_date && (
                            <span
                              style={{
                                backgroundColor: 'rgba(255,255,255,0.1)',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.8rem',
                                color: '#fbbf24'
                              }}
                            >
                              📅 {activeItem.start_date === activeItem.end_date ? activeItem.start_date : `${activeItem.start_date} → ${activeItem.end_date}`}
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                          <strong>Reason:</strong> {activeItem.reason}
                          {(activeItem.description || activeItem.explanation) && (
                            <span style={{ fontStyle: 'italic', marginLeft: '0.5rem', color: '#94a3b8' }}>
                              "{activeItem.description || activeItem.explanation}"
                            </span>
                          )}
                        </div>

                        {!isCancellation && showNoteInput && (
                          <div style={{ marginTop: '0.4rem' }}>
                            <input
                              type="text"
                              value={reviewNote}
                              onChange={(e) => setReviewNote(e.target.value)}
                              placeholder="Add an optional note to the worker..."
                              style={{
                                width: '100%',
                                padding: '0.35rem 0.65rem',
                                borderRadius: '6px',
                                border: '1px solid #475569',
                                backgroundColor: '#1e293b',
                                color: '#ffffff',
                                fontSize: '0.8rem'
                              }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem',
                          flexWrap: 'wrap'
                        }}
                      >
                        {!isCancellation && (
                          <button
                            type="button"
                            onClick={() => setShowNoteInput(!showNoteInput)}
                            style={{
                              background: 'none',
                              border: '1px solid rgba(255,255,255,0.25)',
                              color: '#cbd5e1',
                              borderRadius: '6px',
                              padding: '0.4rem 0.75rem',
                              fontSize: '0.8rem',
                              cursor: 'pointer'
                            }}
                          >
                            {showNoteInput ? 'Hide Note' : '+ Add Note'}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDecision('rejected')}
                          disabled={actionLoading}
                          style={{
                            backgroundColor: '#dc2626',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '0.45rem 1rem',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: actionLoading ? 'not-allowed' : 'pointer',
                            opacity: actionLoading ? 0.7 : 1
                          }}
                        >
                          {isCancellation ? t('rejectCancellation', '✕ Reject Cancellation') : '✕ Decline'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDecision('approved')}
                          disabled={actionLoading}
                          style={{
                            backgroundColor: '#10b981',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '0.45rem 1.25rem',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            cursor: actionLoading ? 'not-allowed' : 'pointer',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                            opacity: actionLoading ? 0.7 : 1
                          }}
                        >
                          {actionLoading ? 'Processing…' : (isCancellation ? t('approveCancellation', '✓ Approve Cancellation') : '✓ Approve Leave')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* WORKER PORTAL VIEW */}
              {role === 'worker' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                        Job: {jobInfo.title || 'Assigned Job'}
                      </span>
                      {activeItem.start_date && (
                        <span
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.15)',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            color: '#e2e8f0'
                          }}
                        >
                          📅 {activeItem.start_date === activeItem.end_date ? activeItem.start_date : `${activeItem.start_date} → ${activeItem.end_date}`}
                        </span>
                      )}
                      <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                        Reason: {activeItem.reason}
                      </span>
                    </div>

                    {activeItem.review_notes && (
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#cbd5e1', fontStyle: 'italic' }}>
                        Employer note: "{activeItem.review_notes}"
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {!isCancellation && activeItem.status === 'approved' && (
                      <button
                        type="button"
                        onClick={async () => {
                          const confirmPrompt = t(
                            'confirmCancelApprovedLeave',
                            'Are you sure you want to cancel this approved leave and return to active work?'
                          );
                          if (!window.confirm(confirmPrompt)) return;
                          try {
                            await cancelMyLeave(activeItem.id);
                            handleDismiss();
                            window.location.reload();
                          } catch (err) {
                            alert(err.message || 'Failed to cancel leave.');
                          }
                        }}
                        style={{
                          backgroundColor: '#dc2626',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '0.4rem 0.85rem',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        ✕ {t('cancelApprovedLeave', 'Cancel Leave & Return to Work')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        handleDismiss();
                        navigate('/worker/dashboard');
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.15)',
                        border: 'none',
                        color: '#ffffff',
                        borderRadius: '6px',
                        padding: '0.4rem 0.85rem',
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      {t('viewInDashboard', 'View in Dashboard')}
                    </button>
                    <button
                      type="button"
                      onClick={handleDismiss}
                      style={{
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.4rem 0.85rem',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {activeItem.status === 'approved' ? t('gotIt', 'Got it ✓') : t('acknowledge', 'Acknowledge')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}
