import React, { useState, useEffect } from 'react';
import { getWorkerReplacementInvitations, respondReplacementInvitation } from '../../services/api';

export default function WorkerReplacementInvitationsSection() {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [respondingId, setRespondingId] = useState(null);

  const loadInvitations = async () => {
    try {
      setLoading(true);
      const res = await getWorkerReplacementInvitations();
      setInvitations(res.invitations || []);
    } catch {
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvitations();
  }, []);

  const handleRespond = async (invitationId, decision) => {
    setRespondingId(invitationId);
    setActionError('');
    setActionSuccess('');

    try {
      await respondReplacementInvitation(invitationId, decision);
      setActionSuccess(`You have ${decision === 'accepted' ? 'accepted' : 'declined'} this replacement invitation.`);
      loadInvitations();
    } catch (err) {
      setActionError(err.message || 'Failed to respond to invitation.');
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.15rem', color: '#0f172a' }}>
          🚨 Emergency Replacement Job Opportunities ({invitations.length})
        </h3>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
          When an employer urgently needs a worker to replace someone on leave or unavailable, direct invitations appear here.
        </p>
      </div>

      {actionError && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '0.875rem', marginBottom: '1rem' }}>
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#15803d', fontSize: '0.875rem', marginBottom: '1rem' }}>
          {actionSuccess}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Checking for replacement invitations…</p>
      ) : invitations.length === 0 ? (
        <div style={{ padding: '1.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', textAlign: 'center' }}>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
            No emergency replacement invitations right now.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {invitations.map((inv) => {
            const job = inv.jobs || {};
            const rep = inv.emergency_replacements || {};
            const isPending = inv.status === 'pending';

            return (
              <div
                key={inv.id}
                style={{
                  border: isPending ? '2px solid #fdba74' : '1px solid #e2e8f0',
                  backgroundColor: isPending ? '#fff7ed' : '#f8fafc',
                  borderRadius: '10px',
                  padding: '1.25rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="badge" style={{ backgroundColor: '#ffedd5', color: '#9a3412', fontWeight: 800 }}>
                        URGENT REPLACEMENT
                      </span>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a' }}>
                        {job.title || 'Worksite Project'}
                      </h4>
                    </div>
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#475569' }}>
                      📍 {job.location || job.worksite_address || 'Bengaluru'} · Required Skill: <strong>{rep.required_skill || job.required_skill || 'General'}</strong>
                    </p>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#15803d', fontWeight: 700 }}>
                      Date: {rep.replacement_date || job.job_date} ({rep.start_time || '09:00'}, {rep.duration_hours || 8} hrs) · ₹{job.wage_per_worker || job.wage || 800}/day
                    </p>
                    {rep.additional_notes && (
                      <p style={{ margin: '0.35rem 0 0', fontSize: '0.775rem', color: '#64748b', fontStyle: 'italic' }}>
                        Customer note: "{rep.additional_notes}"
                      </p>
                    )}
                  </div>

                  <div>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: inv.status === 'accepted' ? '#dcfce7' : inv.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                        color: inv.status === 'accepted' ? '#166534' : inv.status === 'rejected' ? '#991b1b' : '#92400e'
                      }}
                    >
                      {inv.status?.toUpperCase()}
                    </span>
                  </div>
                </div>

                {isPending && (
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                    <button
                      type="button"
                      onClick={() => handleRespond(inv.id, 'accepted')}
                      disabled={respondingId === inv.id}
                      className="btn btn-sm btn-primary"
                      style={{ backgroundColor: '#16a34a', borderColor: '#15803d' }}
                    >
                      {respondingId === inv.id ? 'Processing…' : '✓ Accept Replacement'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRespond(inv.id, 'rejected')}
                      disabled={respondingId === inv.id}
                      className="btn btn-sm btn-outline"
                    >
                      Decline
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
