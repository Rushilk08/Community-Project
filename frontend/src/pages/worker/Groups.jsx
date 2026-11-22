import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createWorkerGroup } from '../../services/api';
import ErrorMessage from '../../components/ErrorMessage';

export default function WorkerGroups() {
  const { t } = useTranslation();
  const [groupName, setGroupName] = useState('');
  const [membersCount, setMembersCount] = useState(3);
  const [skills, setSkills] = useState('Masonry & General');
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg('');

    try {
      await createWorkerGroup({
        group_name: groupName,
        members_count: Number(membersCount),
        skills
      });
      setSuccessMsg('Worker group created successfully! Contractors can now hire your team as a group.');
      setGroupName('');
    } catch (err) {
      setError(err.message || 'Failed to create group.');
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">{t('workerGroups')}</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Form family or friend labour groups to accept bulk work orders together.
          </p>
        </div>

        {successMsg && (
          <div style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.9rem' }}>
            ✅ {successMsg}
          </div>
        )}

        {error && <ErrorMessage message={error} />}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="group-name">Group / Family Name *</label>
            <input
              id="group-name"
              type="text"
              required
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="form-input"
              placeholder="e.g. Ramesh & Sons Construction Team"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="group-count">Number of Workers in Group *</label>
            <input
              id="group-count"
              type="number"
              min="2"
              max="20"
              required
              value={membersCount}
              onChange={(e) => setMembersCount(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="group-skills">Group Skills / Services</label>
            <input
              id="group-skills"
              type="text"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              className="form-input"
              placeholder="e.g. Masonry, Helpers, Brickloading"
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            {t('save')} Group Profile
          </button>
        </form>

        <div style={{ marginTop: '1.5rem' }}>
          <Link to="/worker/dashboard" className="btn btn-outline">
            &larr; {t('dashboard')}
          </Link>
        </div>
      </div>
    </div>
  );
}
