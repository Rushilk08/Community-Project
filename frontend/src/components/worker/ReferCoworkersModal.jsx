import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pledgeWorkerTeam, submitWorkerReferral } from '../../services/api';

export default function ReferCoworkersModal({
  isOpen,
  job,
  onClose,
  onSuccess
}) {
  if (!isOpen || !job) return null;

  const totalNeeded = Number(job.workers_needed || job.workers_required || 1);
  const confirmed = Number(job.confirmed_workers || 1);
  const maxVacancies = Math.max(1, Number(job.remaining_vacancies ?? (totalNeeded - confirmed)));

  // "I have the remaining persons" checkbox (default true so worker can accept with 1 tap)
  const [hasRemainingTeam, setHasRemainingTeam] = useState(true);
  const [showManualForm, setShowManualForm] = useState(false);

  // Manual typing fallback state
  const defaultCandidate = () => ({
    name: '',
    phone: '',
    skills: job.required_skill || job.skill || 'General Labour',
    experience: '',
    notes: ''
  });

  const [candidates, setCandidates] = useState([defaultCandidate()]);
  const [consent, setConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedCount, setSubmittedCount] = useState(0);

  const handlePledgeTeam = async () => {
    if (!hasRemainingTeam) {
      setError('Please mark the box to confirm you have the remaining workers.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await pledgeWorkerTeam({
        job_id: job.job_id || job.id,
        remaining_count: maxVacancies,
        notes: `Worker confirmed: 'I have remaining ${maxVacancies} person(s) for this work'`
      });
      setSubmittedCount(maxVacancies);
      if (onSuccess) {
        onSuccess(maxVacancies);
      }
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err) {
      setError(err.message || 'Failed to confirm your team.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setError('');

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (!c.name.trim() || c.name.trim().length < 2) {
        setError(`Please enter a valid name for Worker #${i + 1}.`);
        return;
      }
      if (!c.phone.trim() || c.phone.trim().length < 8) {
        setError(`Please enter a valid phone number for Worker #${i + 1}.`);
        return;
      }
    }

    if (!consent) {
      setError("Please confirm you have the candidates' consent to recommend them.");
      return;
    }

    setSubmitting(true);
    let successCount = 0;
    try {
      for (const c of candidates) {
        await submitWorkerReferral({
          job_id: job.job_id || job.id,
          candidate_name: c.name.trim(),
          candidate_phone: c.phone.trim(),
          candidate_skills: c.skills.trim(),
          experience: c.experience.trim(),
          location: job.location || job.worksite_address || '',
          notes: c.notes.trim() || `Referred while accepting job '${job.title}'`,
          consent_confirmed: true
        });
        successCount++;
      }

      setSubmittedCount(successCount);
      if (onSuccess) {
        onSuccess(successCount);
      }
      setTimeout(() => {
        onClose();
      }, 1600);
    } catch (err) {
      setError(err.message || 'Failed to submit recommendations.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCandidate = () => {
    if (candidates.length < maxVacancies) {
      setCandidates((prev) => [...prev, defaultCandidate()]);
    }
  };

  const handleRemoveCandidate = (index) => {
    if (candidates.length > 1) {
      setCandidates((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleChange = (index, field, value) => {
    setCandidates((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 100000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            maxWidth: '580px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0',
            padding: '1.75rem'
          }}
        >
          {submittedCount > 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem' }}>🎉</div>
              <h3 style={{ fontSize: '1.4rem', color: '#166534', fontWeight: 700, marginBottom: '0.5rem' }}>
                Full Team Confirmed!
              </h3>
              <p style={{ color: '#4b5563', fontSize: '1rem', margin: 0, lineHeight: 1.5 }}>
                The customer has been notified that you have the remaining <strong>{submittedCount} worker{submittedCount > 1 ? 's' : ''}</strong> and will bring them with you to the worksite.
              </p>
            </div>
          ) : (
            <div>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      backgroundColor: '#dcfce7',
                      color: '#15803d',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      textTransform: 'uppercase',
                      marginBottom: '0.4rem'
                    }}
                  >
                    🎉 You're In! • {maxVacancies} Vacanc{maxVacancies > 1 ? 'ies' : 'y'} Remaining
                  </span>
                  <h3 style={{ margin: 0, fontSize: '1.3rem', color: '#0f172a', fontWeight: 700 }}>
                    Remaining Workers Needed
                  </h3>
                  <p style={{ margin: '0.35rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                    This job needs <strong>{totalNeeded} workers</strong> ({confirmed} confirmed, <strong>{maxVacancies} open</strong>).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '8px',
                    width: '32px',
                    height: '32px',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Skip"
                >
                  ✕
                </button>
              </div>

              {/* Job summary pill */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.25rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}
              >
                <div>
                  <strong style={{ color: '#1e293b', fontSize: '0.95rem' }}>{job.title}</strong>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    📍 {job.location || job.worksite_address || 'Worksite'} • {job.required_skill || job.skill || 'General Labour'}
                  </div>
                </div>
                <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#16a34a' }}>
                  ₹{job.wage || job.agreed_wage}/day
                </span>
              </div>

              {error && (
                <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  {error}
                </div>
              )}

              {/* PRIMARY ONE-CLICK CHECKBOX FLOW (NO TYPING) */}
              {!showManualForm ? (
                <div>
                  <div
                    onClick={() => setHasRemainingTeam(!hasRemainingTeam)}
                    style={{
                      border: hasRemainingTeam ? '2px solid #16a34a' : '2px solid #cbd5e1',
                      backgroundColor: hasRemainingTeam ? '#f0fdf4' : '#ffffff',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '1rem',
                      marginBottom: '1.25rem',
                      boxShadow: hasRemainingTeam ? '0 4px 14px rgba(22, 163, 74, 0.12)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <input
                      type="checkbox"
                      id="team-pledge-check"
                      checked={hasRemainingTeam}
                      onChange={(e) => setHasRemainingTeam(e.target.checked)}
                      style={{
                        width: '24px',
                        height: '24px',
                        accentColor: '#16a34a',
                        marginTop: '2px',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <label
                        htmlFor="team-pledge-check"
                        style={{
                          fontSize: '1.1rem',
                          fontWeight: 700,
                          color: hasRemainingTeam ? '#14532d' : '#0f172a',
                          cursor: 'pointer',
                          display: 'block'
                        }}
                      >
                        I have the remaining {maxVacancies} person{maxVacancies > 1 ? 's' : ''} is there for this work
                      </label>
                      <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem', color: '#475569', lineHeight: 1.45 }}>
                        Mark this box to confirm that you will bring <strong>{maxVacancies} coworker{maxVacancies > 1 ? 's' : ''}</strong> with you to the job site. You don't have to type any names or phone numbers!
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={onClose}
                      style={{
                        backgroundColor: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        color: '#64748b',
                        padding: '0.75rem 1.25rem',
                        borderRadius: '10px',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Skip
                    </button>

                    <button
                      type="button"
                      onClick={handlePledgeTeam}
                      disabled={!hasRemainingTeam || submitting}
                      style={{
                        flex: 1,
                        backgroundColor: hasRemainingTeam ? '#16a34a' : '#94a3b8',
                        border: 'none',
                        color: '#ffffff',
                        padding: '0.8rem 1.25rem',
                        borderRadius: '10px',
                        fontSize: '1rem',
                        fontWeight: 700,
                        cursor: (!hasRemainingTeam || submitting) ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        boxShadow: hasRemainingTeam ? '0 4px 12px rgba(22, 163, 74, 0.35)' : 'none'
                      }}
                    >
                      {submitting ? 'Confirming...' : `✅ Confirm I Have Remaining ${maxVacancies} Worker${maxVacancies > 1 ? 's' : ''}`}
                    </button>
                  </div>

                  {/* Optional collapsible link to enter names manually if desired */}
                  <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setShowManualForm(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      Want to type specific worker names & phone numbers instead?
                    </button>
                  </div>
                </div>
              ) : (
                /* MANUAL FORM (OPTIONAL) */
                <form onSubmit={handleManualSubmit}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Enter Worker Details:</span>
                    <button
                      type="button"
                      onClick={() => setShowManualForm(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2563eb',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      &larr; Back to simple checkbox
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                    {candidates.map((cand, idx) => (
                      <div
                        key={idx}
                        style={{
                          border: '1px solid #cbd5e1',
                          borderRadius: '10px',
                          padding: '0.85rem',
                          backgroundColor: '#f8fafc'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 700, color: '#1e40af', fontSize: '0.85rem' }}>
                            👤 Candidate #{idx + 1}
                          </span>
                          {candidates.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCandidate(idx)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer' }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                          <input
                            type="text"
                            required
                            placeholder="Name *"
                            value={cand.name}
                            onChange={(e) => handleChange(idx, 'name', e.target.value)}
                            style={{ padding: '0.45rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                          />
                          <input
                            type="tel"
                            required
                            placeholder="Phone *"
                            value={cand.phone}
                            onChange={(e) => handleChange(idx, 'phone', e.target.value)}
                            style={{ padding: '0.45rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {candidates.length < maxVacancies && (
                    <button
                      type="button"
                      onClick={handleAddCandidate}
                      style={{
                        backgroundColor: '#f8fafc',
                        border: '1px dashed #3b82f6',
                        color: '#2563eb',
                        borderRadius: '8px',
                        padding: '0.45rem 1rem',
                        width: '100%',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        marginBottom: '1rem'
                      }}
                    >
                      + Add Another ({maxVacancies - candidates.length} more)
                    </button>
                  )}

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#475569', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                      />
                      <span>I confirm I have their consent to share details.</span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowManualForm(false)}
                      style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      style={{
                        backgroundColor: '#16a34a',
                        border: 'none',
                        color: '#fff',
                        padding: '0.5rem 1.25rem',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: submitting ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {submitting ? 'Submitting...' : 'Submit Details'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
