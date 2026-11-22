import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createJob } from '../../services/api';
import ErrorMessage from '../../components/ErrorMessage';

export default function PostJob() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    skill: 'General Labour',
    wage: 850,
    workers_required: 2,
    location: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await createJob({
        ...formData,
        wage: Number(formData.wage),
        workers_required: Number(formData.workers_required)
      });
      const createdJobId = res?.job?.id || 'job-101';
      navigate(`/customer/live-hiring?jobId=${createdJobId}`);
    } catch (err) {
      setError(err.message || 'Failed to post job. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">{t('postJob')}</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Request daily-wage workers for your site. Offers will be dispatched to nearby workers immediately.
          </p>
        </div>

        {error && <ErrorMessage message={error} />}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="job-title">Job Title *</label>
            <input
              id="job-title"
              name="title"
              type="text"
              required
              value={formData.title}
              onChange={handleChange}
              className="form-input"
              placeholder="e.g. Masonry for compound wall"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="job-desc">{t('jobDescription')} *</label>
            <textarea
              id="job-desc"
              name="description"
              required
              rows={3}
              value={formData.description}
              onChange={handleChange}
              className="form-textarea"
              placeholder="Describe the tasks, working hours, and tools required..."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="job-skill">{t('skill')}</label>
              <select
                id="job-skill"
                name="skill"
                value={formData.skill}
                onChange={handleChange}
                className="form-select"
              >
                <option value="General Labour">General Labour</option>
                <option value="Mason">Mason</option>
                <option value="Painter">Painter</option>
                <option value="Carpenter">Carpenter</option>
                <option value="Plumber">Plumber</option>
                <option value="Loader / Mover">Loader / Mover</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="job-wage">{t('wage')} (₹ / day) *</label>
              <input
                id="job-wage"
                name="wage"
                type="number"
                min="300"
                required
                value={formData.wage}
                onChange={handleChange}
                className="form-input"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="job-workers">{t('workersRequired')} *</label>
              <input
                id="job-workers"
                name="workers_required"
                type="number"
                min="1"
                required
                value={formData.workers_required}
                onChange={handleChange}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="job-date">Date *</label>
              <input
                id="job-date"
                name="date"
                type="date"
                required
                value={formData.date}
                onChange={handleChange}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="job-location">{t('location')} *</label>
            <input
              id="job-location"
              name="location"
              type="text"
              required
              value={formData.location}
              onChange={handleChange}
              className="form-input"
              placeholder="e.g. 5th Cross, Indiranagar, Bengaluru"
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              {isSubmitting ? t('loading') : t('postJob')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/customer/dashboard')}
              className="btn btn-outline"
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
