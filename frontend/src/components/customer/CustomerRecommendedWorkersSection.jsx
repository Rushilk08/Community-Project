import React, { useState, useEffect } from 'react';
import { getCustomerReferrals, resolveReferral } from '../../services/api';

export default function CustomerRecommendedWorkersSection() {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [resolvingId, setResolvingId] = useState(null);

  const loadReferrals = async () => {
    try {
      setLoading(true);
      const res = await getCustomerReferrals();
      setReferrals(res.referrals || []);
    } catch (err) {
      setError(err.message || 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReferrals();
  }, []);

  const handleDecision = async (referralId, decision) => {
    setResolvingId(referralId);
    setError('');
    setSuccessMsg('');
    try {
      await resolveReferral(referralId, decision);
      setSuccessMsg(`Candidate ${decision === 'accepted' ? 'accepted and added to vacant position!' : 'declined.'}`);
      loadReferrals();
    } catch (err) {
      setError(err.message || `Failed to ${decision} candidate.`);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.15rem', color: '#0f172a' }}>
          🤝 Recommended Candidates from Registered Workers ({referrals.length})
        </h3>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
          Candidates recommended by workers to fill your vacant positions. Review and approve them separately from standard applicants.
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
        <p style={{ color: '#94a3b8' }}>Loading worker recommendations…</p>
      ) : referrals.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
            No worker recommendations received for your jobs yet. When registered workers recommend peers, they will appear here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {referrals.map((ref) => {
            const isPending = ref.status === 'pending' || ref.status === 'invited' || ref.status === 'registered';
            const job = ref.jobs || {};
            const referringWorker = ref.profiles?.full_name || 'A registered worker';

            return (
              <div
                key={ref.id}
                style={{
                  border: isPending ? '2px solid #93c5fd' : '1px solid #e2e8f0',
                  backgroundColor: isPending ? '#eff6ff' : '#f8fafc',
                  borderRadius: '10px',
                  padding: '1.25rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="badge" style={{ backgroundColor: '#dbeafe', color: '#1e40af', fontWeight: 800 }}>
                        RECOMMENDED CANDIDATE
                      </span>
                      <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
                        {ref.candidate_name}
                      </h4>
                      <span className="badge badge-neutral">
                        {ref.status?.toUpperCase()}
                      </span>
                    </div>

                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#334155' }}>
                      Skills: <strong>{ref.candidate_skills}</strong> · Phone: <strong>{ref.candidate_phone}</strong> {ref.location ? `· Location: ${ref.location}` : ''}
                    </p>
                    {ref.experience && (
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#475569' }}>
                        Experience: {ref.experience}
                      </p>
                    )}
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                      Recommended by: <strong>{referringWorker}</strong> for job: <strong>{job.title || 'Your job posting'}</strong>
                    </p>
                    {ref.notes && (
                      <p style={{ margin: '0.35rem 0 0', fontSize: '0.775rem', color: '#0369a1', fontStyle: 'italic' }}>
                        Worker note: "{ref.notes}"
                      </p>
                    )}
                  </div>
                </div>

                {isPending && (
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                    <button
                      type="button"
                      onClick={() => handleDecision(ref.id, 'accepted')}
                      disabled={resolvingId === ref.id}
                      className="btn btn-sm btn-primary"
                      style={{ backgroundColor: '#16a34a', borderColor: '#15803d' }}
                    >
                      {resolvingId === ref.id ? 'Processing…' : '✓ Accept & Hire Candidate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecision(ref.id, 'rejected')}
                      disabled={resolvingId === ref.id}
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
