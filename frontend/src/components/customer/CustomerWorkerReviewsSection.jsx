import React, { useState, useEffect } from 'react';
import { getMyJobs, submitWorkerReview } from '../../services/api';

export default function CustomerWorkerReviewsSection() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Rating Form State
  const [selectedJobId, setSelectedJobId] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [punctuality, setPunctuality] = useState(5);
  const [quality, setQuality] = useState(5);
  const [professionalism, setProfessionalism] = useState(5);
  const [reliability, setReliability] = useState(5);
  const [communication, setCommunication] = useState(5);
  const [reviewText, setReviewText] = useState('');

  const loadJobs = async () => {
    try {
      setLoading(true);
      const res = await getMyJobs();
      setJobs(res.jobs || []);
    } catch (err) {
      setError(err.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const completedJobs = jobs.filter((j) => (j.status || '').toLowerCase() === 'completed');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!selectedJobId) {
      setError('Please select a completed job.');
      return;
    }
    if (!workerId) {
      setError('Please enter the Worker ID to rate.');
      return;
    }

    setSubmitting(true);
    try {
      await submitWorkerReview({
        job_id: selectedJobId,
        worker_id: workerId,
        booking_id: bookingId || 'booking-verified',
        punctuality_rating: Number(punctuality),
        quality_rating: Number(quality),
        professionalism_rating: Number(professionalism),
        reliability_rating: Number(reliability),
        communication_rating: Number(communication),
        review_text: reviewText.trim()
      });
      setSuccessMsg(`Rating & review submitted successfully!`);
      setWorkerId('');
      setWorkerName('');
      setBookingId('');
      setReviewText('');
    } catch (err) {
      setError(err.message || 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  const categories = [
    { key: 'punctuality', label: '1. Punctuality (Did worker arrive on time?)', val: punctuality, setVal: setPunctuality },
    { key: 'quality', label: '2. Work Quality (Was work completed properly?)', val: quality, setVal: setQuality },
    { key: 'professionalism', label: '3. Professionalism (Respectful & cooperative?)', val: professionalism, setVal: setProfessionalism },
    { key: 'reliability', label: '4. Reliability (Fulfilled commitment?)', val: reliability, setVal: setReliability },
    { key: 'communication', label: '5. Communication (Communicated clearly?)', val: communication, setVal: setCommunication }
  ];

  return (
    <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.15rem', color: '#0f172a' }}>
          ⭐ Rate & Review Workers (Completed Jobs Only)
        </h3>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
          WorkLink enforces strict trust rules: ratings can only be submitted by verified employers for fully completed jobs. One rating per worker per job.
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
        <p style={{ color: '#94a3b8' }}>Checking completed jobs…</p>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Select Job (Completed Only) *
            </label>
            {jobs.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No posted jobs found.</p>
            ) : (
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="form-input"
                style={{ width: '100%' }}
                required
              >
                <option value="">-- Choose a job --</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} · Status: {j.status?.toUpperCase()} ({j.confirmed_workers} workers)
                  </option>
                ))}
              </select>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Worker ID / UUID *
              </label>
              <input
                type="text"
                className="form-input"
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value)}
                placeholder="Worker UUID from job assignment"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Worker Name (Reference)
              </label>
              <input
                type="text"
                className="form-input"
                value={workerName}
                onChange={(e) => setWorkerName(e.target.value)}
                placeholder="e.g. Ramesh"
              />
            </div>
          </div>

          {/* 5 Rating Categories */}
          <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 1rem', fontSize: '0.95rem', color: '#1e293b' }}>
              5-Category Performance Assessment (1 to 5 Stars)
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {categories.map((cat) => (
                <div key={cat.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 500 }}>
                    {cat.label}
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => cat.setVal(star)}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          border: cat.val >= star ? '1px solid #ca8a04' : '1px solid #cbd5e1',
                          backgroundColor: cat.val >= star ? '#fef08a' : '#ffffff',
                          color: cat.val >= star ? '#854d0e' : '#94a3b8',
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {star}★
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Written Feedback / Review
            </label>
            <textarea
              className="form-input"
              rows={3}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Describe worker's attitude, punctuality, craftsmanship, and work completion..."
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{ padding: '0.65rem 1.5rem' }}
            >
              {submitting ? 'Submitting Review…' : 'Submit Worker Rating & Review ➔'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
