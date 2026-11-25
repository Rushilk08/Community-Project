import React, { useState, useEffect } from 'react';
import { getAvailableJobsForReferral, submitWorkerReferral, getMyReferrals } from '../../services/api';

export default function WorkerReferralsSection() {
  const [availableJobs, setAvailableJobs] = useState([]);
  const [myReferrals, setMyReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Form State
  const [selectedJobId, setSelectedJobId] = useState('');
  const [candidateName, setCandidateName] = useState('');
  const [candidatePhone, setCandidatePhone] = useState('');
  const [candidateSkills, setCandidateSkills] = useState('');
  const [experience, setExperience] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [consentConfirmed, setConsentConfirmed] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [jobsRes, refsRes] = await Promise.all([
        getAvailableJobsForReferral().catch(() => ({ jobs: [] })),
        getMyReferrals().catch(() => ({ referrals: [] }))
      ]);
      setAvailableJobs(jobsRes.jobs || []);
      setMyReferrals(refsRes.referrals || []);
      if (jobsRes.jobs && jobsRes.jobs.length > 0 && !selectedJobId) {
        setSelectedJobId(jobsRes.jobs[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load referral details');
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

    if (!selectedJobId) {
      setError('Please select an open job to refer for.');
      return;
    }
    if (!candidateName.trim() || !candidatePhone.trim() || !candidateSkills.trim()) {
      setError('Please fill in candidate name, phone number, and skills.');
      return;
    }
    if (!consentConfirmed) {
      setError('You must confirm candidate consent before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitWorkerReferral({
        job_id: selectedJobId,
        candidate_name: candidateName.trim(),
        candidate_phone: candidatePhone.trim(),
        candidate_skills: candidateSkills.trim(),
        experience: experience.trim(),
        location: location.trim(),
        notes: notes.trim(),
        consent_confirmed: true
      });
      setSuccessMsg('Worker recommendation submitted! The invitation link is ready to share.');
      setCandidateName('');
      setCandidatePhone('');
      setCandidateSkills('');
      setExperience('');
      setLocation('');
      setNotes('');
      setConsentConfirmed(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to submit recommendation.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyInviteLink = (referralId) => {
    const link = `${window.location.origin}/register?ref=${referralId}`;
    navigator.clipboard.writeText(link);
    setCopiedId(referralId);
    setTimeout(() => setCopiedId(null), 3000);
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'accepted':
        return <span className="badge badge-success">Accepted by Employer</span>;
      case 'rejected':
        return <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>Not Selected</span>;
      case 'registered':
        return <span className="badge" style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}>Candidate Registered</span>;
      case 'invited':
        return <span className="badge" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>Invitation Sent</span>;
      default:
        return <span className="badge badge-neutral">Pending Review</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Referral Form */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.15rem', color: '#0f172a' }}>
            🤝 Recommend Someone to Fill Vacant Positions
          </h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            Know someone suitable for an open job? Submit their details and they will receive an invitation to join WorkLink.
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

        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Select Job with Open Vacancy *
            </label>
            {availableJobs.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic' }}>
                No jobs with open vacancies right now.
              </p>
            ) : (
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
                required
              >
                {availableJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} · {j.required_skill || j.skill} · ₹{j.wage_per_worker || j.wage}/day ({j.vacancies_remaining ?? 1} positions vacant)
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Candidate Full Name *
            </label>
            <input
              type="text"
              className="form-input"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              placeholder="e.g. Anand Kumar"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Mobile Phone Number *
            </label>
            <input
              type="tel"
              className="form-input"
              value={candidatePhone}
              onChange={(e) => setCandidatePhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Skills or Type of Work *
            </label>
            <input
              type="text"
              className="form-input"
              value={candidateSkills}
              onChange={(e) => setCandidateSkills(e.target.value)}
              placeholder="e.g. Masonry, Bricklaying, Plastering"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Location / Area
            </label>
            <input
              type="text"
              className="form-input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Indiranagar, Bengaluru"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Experience (Optional)
            </label>
            <input
              type="text"
              className="form-input"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder="e.g. 4 years in site masonry"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Short Recommendation Note (Optional)
            </label>
            <input
              type="text"
              className="form-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Punctual and hardworking worker"
            />
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#475569' }}>
              <input
                type="checkbox"
                checked={consentConfirmed}
                onChange={(e) => setConsentConfirmed(e.target.checked)}
                required
              />
              <span>
                I confirm that I have obtained this person's consent to share their contact information with WorkLink.
              </span>
            </label>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
            <button
              type="submit"
              disabled={submitting || availableJobs.length === 0}
              className="btn btn-primary"
              style={{ padding: '0.65rem 1.5rem' }}
            >
              {submitting ? 'Submitting Referral…' : 'Submit Recommendation ➔'}
            </button>
          </div>
        </form>
      </div>

      {/* Referral History & Tracking */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1.15rem', color: '#0f172a' }}>
          📋 Track Your Referrals ({myReferrals.length})
        </h3>

        {loading ? (
          <p style={{ color: '#94a3b8' }}>Loading your referrals…</p>
        ) : myReferrals.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
              You haven't recommended anyone yet. Use the form above to recommend a friend or colleague for open positions.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {myReferrals.map((ref) => (
              <div
                key={ref.id}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong style={{ color: '#1e293b', fontSize: '0.95rem' }}>
                      {ref.candidate_name}
                    </strong>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      ({ref.candidate_skills})
                    </span>
                    {getStatusBadge(ref.status)}
                  </div>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.825rem', color: '#475569' }}>
                    Job: <strong>{ref.jobs?.title || 'Job Posting'}</strong> · Phone: {ref.candidate_phone}
                  </p>
                  {ref.experience && (
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '2px' }}>
                      Experience: {ref.experience}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => copyInviteLink(ref.id)}
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                  >
                    {copiedId === ref.id ? '✓ Link Copied!' : '🔗 Copy Invite Link'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
