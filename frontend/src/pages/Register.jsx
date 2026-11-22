import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import ErrorMessage from '../components/ErrorMessage';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Register() {
  const { t } = useTranslation();
  const { signUp, error: authError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const roleFromPath = location.pathname.startsWith('/customer') ? 'customer'
    : location.pathname.startsWith('/worker') ? 'worker'
    : null;

  const [role, setRole] = useState(roleFromPath || 'worker');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [skill, setSkill] = useState('General Labour');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!email || !password || !fullName) {
      setLocalError('Please complete all required fields.');
      return;
    }

    setIsSubmitting(true);
    const { data, error } = await signUp({
      email,
      password,
      role,
      fullName,
      phone,
      metadata: { skill: role === 'worker' ? skill : undefined }
    });
    setIsSubmitting(false);

    if (error) {
      setLocalError(error.message || 'Registration failed.');
      return;
    }

    if (role === 'customer') {
      navigate('/customer/dashboard', { replace: true });
    } else {
      navigate('/worker/dashboard', { replace: true });
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
      <div className="auth-language"><LanguageSwitcher /></div>
      <Link to="/" className="public-brand auth-brand"><span className="brand-mark">WS</span><span>WorkSetu</span></Link>
      <div className="auth-card">
      <div className="card">
        <div className="card-header" style={{ textAlign: 'center' }}>
          <h2 className="card-title" style={{ fontSize: '1.5rem', color: 'var(--primary)' }}>WorkSetu</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            {t('register')}
          </p>
        </div>

        {(localError || authError) && (
          <ErrorMessage message={localError || authError} />
        )}

        <form onSubmit={handleSubmit}>
          {/* Role Selection */}
          <div className="form-group">
            <label className="form-label">{t('role')}</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                className={`btn ${role === 'worker' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setRole('worker')}
              >
                👷 {t('worker')}
              </button>
              <button
                type="button"
                className={`btn ${role === 'customer' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setRole('customer')}
              >
                🏢 {t('customer')}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-name">
              {t('fullName')} *
            </label>
            <input
              id="register-name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="form-input"
              placeholder="e.g. Ramesh Kumar"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-email">
              {t('email')} *
            </label>
            <input
              id="register-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              placeholder="e.g. user@example.com"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-phone">
              {t('phoneNumber')}
            </label>
            <input
              id="register-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="form-input"
              placeholder="e.g. +91 9876543210"
            />
          </div>

          {role === 'worker' && (
            <div className="form-group">
              <label className="form-label" htmlFor="register-skill">
                {t('skill')}
              </label>
              <select
                id="register-skill"
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
                className="form-select"
              >
                <option value="General Labour">General Labour</option>
                <option value="Mason">Mason / Bricklayer</option>
                <option value="Painter">Painter</option>
                <option value="Carpenter">Carpenter</option>
                <option value="Electrician">Electrician</option>
                <option value="Plumber">Plumber</option>
                <option value="Loader / Mover">Loader / Mover</option>
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="register-password">
              {t('password')} *
            </label>
            <input
              id="register-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {isSubmitting ? t('loading') : t('register')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.9rem', color: '#64748b' }}>
          Already have an account?{' '}
          <Link to={roleFromPath ? `/${roleFromPath}/login` : '/login'} style={{ fontWeight: 600 }}>
            {t('login')}
          </Link>
        </div>
      </div>
      </div>
      </div>
    </div>
  );
}
