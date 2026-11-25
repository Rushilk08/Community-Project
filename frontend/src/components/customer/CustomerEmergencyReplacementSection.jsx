import React, { useState, useEffect } from 'react';
import {
  getMyJobs,
  createReplacementRequest,
  getReplacementCandidates,
  sendReplacementInvitations,
  confirmReplacementSelection
} from '../../services/api';

export default function CustomerEmergencyReplacementSection({ initialParams = null }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [selectedJobId, setSelectedJobId] = useState(initialParams?.job_id || '');
  const [originalWorkerId, setOriginalWorkerId] = useState(initialParams?.worker_id || '');
  const [replacementDate, setReplacementDate] = useState(initialParams?.date || new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [durationHours, setDurationHours] = useState(8);
  const [requiredSkill, setRequiredSkill] = useState(initialParams?.skill || '');
  const [workersNeeded, setWorkersNeeded] = useState(1);
  const [triggerReason, setTriggerReason] = useState('approved_leave');
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Search Results & Active Replacement Record
  const [candidates, setCandidates] = useState([]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState(new Set());
  const [activeReplacement, setActiveReplacement] = useState(null);

  useEffect(() => {
    async function loadInitial() {
      try {
        setLoading(true);
        const res = await getMyJobs();
        const jList = res.jobs || [];
        setJobs(jList);
        if (jList.length > 0 && !selectedJobId) {
          setSelectedJobId(jList[0].id);
          setRequiredSkill(jList[0].required_skill || jList[0].skill || 'Mason');
        }
      } catch (err) {
        setError(err.message || 'Failed to load jobs');
      } finally {
        setLoading(false);
      }
    }
    loadInitial();
  }, []);

  const handleSearchCandidates = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setCandidates([]);
    setSelectedWorkerIds(new Set());

    if (!selectedJobId) {
      setError('Please select a job.');
      return;
    }
    if (!replacementDate) {
      setError('Please select the required replacement date.');
      return;
    }

    setSearching(true);
    try {
      // 1. Initialize replacement record
      const repRes = await createReplacementRequest({
        job_id: selectedJobId,
        original_worker_id: originalWorkerId || null,
        replacement_date: replacementDate,
        start_time: startTime,
        duration_hours: Number(durationHours),
        required_skill: requiredSkill,
        workers_needed: Number(workersNeeded),
        trigger_reason: triggerReason,
        additional_notes: additionalNotes
      });
      setActiveReplacement(repRes.replacement);

      // 2. Fetch eligible, conflict-free candidates
      const candRes = await getReplacementCandidates({
        skill: requiredSkill,
        date: replacementDate,
        startTime: startTime,
        duration: durationHours
      });
      setCandidates(candRes.candidates || []);
      if ((candRes.candidates || []).length === 0) {
        setSuccessMsg('Replacement request opened. No other workers currently match this trade without schedule conflicts.');
      }
    } catch (err) {
      setError(err.message || 'Failed to search replacement candidates.');
    } finally {
      setSearching(false);
    }
  };

  const toggleWorkerSelection = (id) => {
    setSelectedWorkerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSendInvitations = async () => {
    if (!activeReplacement?.id || selectedWorkerIds.size === 0) return;
    setInviting(true);
    setError('');
    try {
      await sendReplacementInvitations(activeReplacement.id, Array.from(selectedWorkerIds));
      setSuccessMsg(`Invitations dispatched to ${selectedWorkerIds.size} available replacement candidates!`);
    } catch (err) {
      setError(err.message || 'Failed to dispatch invitations.');
    } finally {
      setInviting(false);
    }
  };

  const handleConfirmWorker = async (workerId) => {
    if (!activeReplacement?.id) return;
    setConfirming(true);
    setError('');
    try {
      await confirmReplacementSelection(activeReplacement.id, workerId);
      setSuccessMsg('Replacement confirmed! The worker has been assigned and the vacant position filled.');
      setCandidates((prev) => prev.filter((c) => c.worker_id !== workerId));
    } catch (err) {
      setError(err.message || 'Failed to confirm replacement worker.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.15rem', color: '#0f172a' }}>
          🚨 Emergency Worker Replacement System
        </h3>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
          When an assigned worker is unavailable due to illness, approved leave, or cancellation, find and invite verified replacement candidates without reposting your entire job.
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

      {/* Step 1: Configuration & Conflict-Free Search */}
      <form onSubmit={handleSearchCandidates} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            Job Requiring Replacement *
          </label>
          <select
            value={selectedJobId}
            onChange={(e) => {
              setSelectedJobId(e.target.value);
              const found = jobs.find((j) => j.id === e.target.value);
              if (found) setRequiredSkill(found.required_skill || found.skill || '');
            }}
            className="form-input"
            style={{ width: '100%' }}
            required
          >
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title} ({j.confirmed_workers} workers)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            Replacement Date *
          </label>
          <input
            type="date"
            className="form-input"
            value={replacementDate}
            onChange={(e) => setReplacementDate(e.target.value)}
            required
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            Start Time & Duration
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="time"
              className="form-input"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              style={{ width: '50%' }}
            />
            <input
              type="number"
              className="form-input"
              value={durationHours}
              onChange={(e) => setDurationHours(e.target.value)}
              placeholder="Hrs"
              min={1}
              max={16}
              style={{ width: '50%' }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            Required Trade / Skill
          </label>
          <input
            type="text"
            className="form-input"
            value={requiredSkill}
            onChange={(e) => setRequiredSkill(e.target.value)}
            placeholder="e.g. Mason, Electrician"
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            Trigger Reason
          </label>
          <select
            value={triggerReason}
            onChange={(e) => setTriggerReason(e.target.value)}
            className="form-input"
            style={{ width: '100%' }}
          >
            <option value="approved_leave">Approved Leave</option>
            <option value="emergency_unavailability">Emergency Unavailability</option>
            <option value="approved_cancellation">Approved Job Cancellation</option>
            <option value="no_show">Reported No-Show</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            Additional Requirements (Optional)
          </label>
          <input
            type="text"
            className="form-input"
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="e.g. Must bring basic masonry trowel"
          />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <button
            type="submit"
            disabled={searching}
            className="btn btn-primary"
            style={{ padding: '0.65rem 1.5rem' }}
          >
            {searching ? 'Checking Availability & Conflicts…' : '🔍 Find Available Replacement Candidates'}
          </button>
        </div>
      </form>

      {/* Step 2: Candidates Results & Invitation Flow */}
      {candidates.length > 0 && (
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '1rem', color: '#1e293b' }}>
                Suitable & Available Workers ({candidates.length})
              </h4>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                All candidates passed smart availability checks: zero overlapping jobs and no approved leaves.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSendInvitations}
              disabled={inviting || selectedWorkerIds.size === 0}
              className="btn btn-primary btn-sm"
              style={{ backgroundColor: '#16a34a', borderColor: '#15803d' }}
            >
              {inviting ? 'Dispatching…' : `✉ Send Invitations (${selectedWorkerIds.size})`}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
            {candidates.map((cand) => {
              const isSelected = selectedWorkerIds.has(cand.worker_id);
              return (
                <div
                  key={cand.worker_id}
                  style={{
                    padding: '1rem',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid #16a34a' : '1px solid #cbd5e1',
                    backgroundColor: isSelected ? '#f0fdf4' : '#f8fafc',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.75rem'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>
                        {cand.full_name}
                      </strong>
                      <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                        {cand.rating} ★ ({cand.reviews_count} reviews)
                      </span>
                    </div>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#475569' }}>
                      Trade: <strong>{cand.skill}</strong> · Location: {cand.location}
                    </p>
                    <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600, display: 'block', marginTop: '4px' }}>
                      ✓ Verified Available (No Conflicts)
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => toggleWorkerSelection(cand.worker_id)}
                      className="btn btn-outline btn-sm"
                      style={{ flex: 1, fontSize: '0.75rem' }}
                    >
                      {isSelected ? '✓ Selected' : '+ Select for Invite'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmWorker(cand.worker_id)}
                      disabled={confirming}
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '0.75rem', backgroundColor: '#2563eb', borderColor: '#1d4ed8' }}
                    >
                      ⚡ Instant Confirm
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
