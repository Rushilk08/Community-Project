import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createJob, generateJobDescription } from '../../services/api';
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
    latitude: null,
    longitude: null,
    date: new Date().toISOString().split('T')[0]
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [error, setError] = useState(null);
  const [descriptionStatus, setDescriptionStatus] = useState('');
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const descriptionEditedRef = useRef(false);
  const descriptionEditVersionRef = useRef(0);
  const titleRef = useRef(formData.title);
  const skillRef = useRef(formData.skill);
  const generationControllerRef = useRef(null);

  titleRef.current = formData.title;
  skillRef.current = formData.skill;

  // Automatically request browser GPS location on page load
  useEffect(() => {
    detectLocation();
  }, []);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported by your browser.');
      return;
    }

    setIsDetectingLocation(true);
    setLocationStatus('Requesting browser location permission...');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        setFormData((prev) => ({
          ...prev,
          latitude: Number(latitude.toFixed(6)),
          longitude: Number(longitude.toFixed(6))
        }));

        setLocationStatus(`📍 GPS detected (${latitude.toFixed(4)}, ${longitude.toFixed(4)}). Fetching address...`);

        // Reverse-geocode coordinates to readable address using free OpenStreetMap Nominatim
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          if (res.ok) {
            const data = await res.json();
            const address = data.display_name || `${data.address?.suburb || ''}, ${data.address?.city || ''}`;
            if (address && address.trim()) {
              setFormData((prev) => ({
                ...prev,
                location: address
              }));
              setLocationStatus(`📍 Live location detected: ${data.address?.suburb || data.address?.city || 'Accurate GPS'}`);
            } else {
              setFormData((prev) => ({
                ...prev,
                location: prev.location || `Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
              }));
              setLocationStatus('📍 Live GPS coordinates saved');
            }
          } else {
            setFormData((prev) => ({
              ...prev,
              location: prev.location || `Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
            }));
            setLocationStatus('📍 Live GPS coordinates saved');
          }
        } catch {
          setFormData((prev) => ({
            ...prev,
            location: prev.location || `Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
          }));
          setLocationStatus('📍 Live GPS coordinates saved');
        } finally {
          setIsDetectingLocation(false);
        }
      },
      (err) => {
        setIsDetectingLocation(false);
        if (err.code === 1) {
          setLocationStatus('⚠️ Location permission denied. Please enter worksite address manually.');
        } else {
          setLocationStatus('⚠️ Could not retrieve GPS location. Please enter worksite address manually.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'description') {
      descriptionEditedRef.current = true;
      descriptionEditVersionRef.current += 1;
      setDescriptionStatus(t('descriptionEdited'));
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const runDescriptionGeneration = useCallback(async ({ force = false } = {}) => {
    const title = formData.title.trim();
    const skill = formData.skill.trim();
    if (title.length < 3 || (!force && descriptionEditedRef.current)) return;

    generationControllerRef.current?.abort();
    const controller = new AbortController();
    const editVersion = descriptionEditVersionRef.current;
    generationControllerRef.current = controller;
    setIsGeneratingDescription(true);
    setDescriptionStatus(t('generatingJobDescription'));

    try {
      const result = await generateJobDescription({
        title,
        skill,
        signal: controller.signal
      });
      if (
        controller.signal.aborted ||
        titleRef.current.trim() !== title ||
        skillRef.current !== skill ||
        descriptionEditVersionRef.current !== editVersion
      ) {
        return;
      }

      setFormData((prev) => ({ ...prev, description: result.description }));
      descriptionEditedRef.current = false;
      setDescriptionStatus(t('jobDescriptionAiReady'));
    } catch (generationError) {
      if (!controller.signal.aborted) {
        setDescriptionStatus(generationError.message || t('jobDescriptionAiUnavailable'));
      }
    } finally {
      if (generationControllerRef.current === controller) {
        generationControllerRef.current = null;
        setIsGeneratingDescription(false);
      }
    }
  }, [formData.skill, formData.title, t]);

  useEffect(() => {
    if (formData.title.trim().length < 3 || descriptionEditedRef.current) return undefined;

    const timer = window.setTimeout(() => {
      runDescriptionGeneration();
    }, 650);

    return () => {
      window.clearTimeout(timer);
      generationControllerRef.current?.abort();
    };
  }, [formData.skill, formData.title, runDescriptionGeneration]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await createJob({
        ...formData,
        wage: Number(formData.wage),
        workers_required: Number(formData.workers_required),
        latitude: formData.latitude,
        longitude: formData.longitude
      });
      const createdJobId = res?.job?.id || res?.data?.id || 'job-101';
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
            Request daily-wage workers for your site. Offers will be dispatched to nearby workers based on live coordinates.
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
            <div className="job-description-label">
              <label className="form-label" htmlFor="job-desc">{t('jobDescription')} *</label>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => runDescriptionGeneration({ force: true })}
                disabled={isGeneratingDescription || formData.title.trim().length < 3}
              >
                {isGeneratingDescription ? t('generatingJobDescription') : t('generateJobDescription')}
              </button>
            </div>
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
            <p className="job-description-status" role="status" aria-live="polite">
              {descriptionStatus || t('jobDescriptionAiHint')}
            </p>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <label className="form-label" htmlFor="job-location" style={{ marginBottom: 0 }}>
                {t('location')} *
              </label>
              <button
                type="button"
                onClick={detectLocation}
                disabled={isDetectingLocation}
                className="btn btn-outline btn-sm"
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                📍 {isDetectingLocation ? 'Detecting...' : 'Detect Live Location'}
              </button>
            </div>
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
            {locationStatus && (
              <p style={{ fontSize: '0.8rem', color: formData.latitude ? '#059669' : '#b45309', marginTop: '0.25rem' }}>
                {locationStatus}
              </p>
            )}
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
