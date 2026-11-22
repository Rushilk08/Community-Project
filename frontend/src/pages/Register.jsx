import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import ErrorMessage from '../components/ErrorMessage';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Register() {
  const { t } = useTranslation();
  const { signUp, error: authError, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const roleFromPath = location.pathname.startsWith('/customer')
    ? 'customer'
    : location.pathname.startsWith('/worker')
    ? 'worker'
    : null;

  const [role, setRole] = useState(roleFromPath || 'worker');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [skill, setSkill] = useState('General Labour');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Email confirmation state
  const [isConfirmationSent, setIsConfirmationSent] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [registeredRole, setRegisteredRole] = useState(role);

  // If user confirms email in another window/tab and returns or session auto-syncs, redirect immediately
  useEffect(() => {
    if (isConfirmationSent && isAuthenticated && user) {
      const destination =
        registeredRole === 'worker' ? '/worker/dashboard' : '/customer/dashboard';
      navigate(destination, { replace: true });
    }
  }, [isConfirmationSent, isAuthenticated, user, registeredRole, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!email || !password || !fullName) {
      setLocalError('Please complete all required fields.');
      return;
    }

    setIsSubmitting(true);
    const result = await signUp({
      email,
      password,
      role,
      fullName,
      phone,
      metadata: { skill: role === 'worker' ? skill : undefined }
    });
    setIsSubmitting(false);

    if (result.error) {
      setLocalError(result.error.message || 'Registration failed.');
      return;
    }

    // If Supabase sent an email confirmation, show confirmation banner and wait
    if (result.isEmailConfirmationRequired) {
      setRegisteredEmail(email);
      setRegisteredRole(role);
      setIsConfirmationSent(true);
      return;
    }

    // Direct login redirect if email confirmation is disabled in Supabase
    if (role === 'customer') {
      navigate('/customer/dashboard', { replace: true });
    } else {
      navigate('/worker/dashboard', { replace: true });
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-language">
          <LanguageSwitcher />
        </div>
        <Link to="/" className="public-brand auth-brand">
          <span className="brand-mark">WL</span>
          <span>WorkLink</span>
        </Link>

        {isConfirmationSent ? (
          /* Confirmation Email Sent View */
          <div className="auth-card">
            <div className="card" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📩</div>
              <h2 style={{ fontSize: '1.4rem', color: '#172033', marginBottom: '0.35rem' }}>
                Confirmation Email Sent!
              </h2>
              <p
                style={{
                  color: '#64748b',
                  fontSize: '0.9rem',
                  marginBottom: '1.25rem',
                  lineHeight: '1.5'
                }}
              >
                We've sent a verification link to{' '}
                <strong style={{ color: '#172033', wordBreak: 'break-all' }}>
                  {registeredEmail}
                </strong>
                .
              </p>

              <div
                className={`auth-profile-indicator ${
                  registeredRole === 'customer' ? 'customer' : 'worker'
                }`}
                style={{ marginBottom: '1.25rem', textAlign: 'left' }}
              >
                <div className="indicator-avatar" aria-hidden="true">
                  {registeredRole === 'customer' ? '🏢' : '👷'}
                </div>
                <div className="indicator-text">
                  <strong>
                    {registeredRole === 'customer' ? 'Customer Profile' : 'Worker Profile'}
                  </strong>
                  <p>
                    Once confirmed, you will be redirected automatically into your{' '}
                    {registeredRole === 'customer' ? 'Customer Workspace' : 'Worker Workspace'}.
                  </p>
                </div>
                <span className="indicator-tag">
                  {registeredRole === 'customer' ? t('customer') : t('worker')}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem',
                  background: '#f8fafc',
                  borderRadius: '10px',
                  fontSize: '0.84rem',
                  color: '#64748b',
                  marginBottom: '1.5rem'
                }}
              >
                <span
                  className="loading-spinner"
                  style={{ width: '14px', height: '14px', borderWidth: '2px' }}
                />
                <span>Waiting for confirmation... You'll be redirected automatically.</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <a
                  href={
                    registeredEmail.includes('gmail.com')
                      ? 'https://mail.google.com'
                      : registeredEmail.includes('outlook.com') ||
                        registeredEmail.includes('hotmail.com')
                      ? 'https://outlook.live.com'
                      : registeredEmail.includes('yahoo.com')
                      ? 'https://mail.yahoo.com'
                      : 'mailto:' + registeredEmail
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                >
                  Open Email Inbox ↗
                </a>

                <Link
                  to={registeredRole === 'customer' ? '/customer/login' : '/worker/login'}
                  className="btn btn-outline"
                  style={{ width: '100%' }}
                >
                  Already Confirmed? Go to Login
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* Registration Form View */
          <div className="auth-card">
            <div className="card">
              <div className="card-header" style={{ textAlign: 'center' }}>
                <h2
                  className="card-title"
                  style={{
                    fontSize: '1.5rem',
                    color: role === 'customer' ? '#173f3d' : 'var(--primary)'
                  }}
                >
                  WorkLink
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                  {role === 'customer' ? `Customer ${t('register')}` : `Worker ${t('register')}`}
                </p>
              </div>

              {(localError || authError) && <ErrorMessage message={localError || authError} />}

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
                      className={`btn ${
                        role === 'customer' ? 'btn-primary btn-customer-auth' : 'btn-outline'
                      }`}
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
                  className={`btn btn-primary ${role === 'customer' ? 'btn-customer-auth' : ''}`}
                  style={{ width: '100%', marginTop: '0.5rem' }}
                >
                  {isSubmitting
                    ? t('loading')
                    : role === 'customer'
                    ? `Register Customer Profile →`
                    : `Register Worker Profile →`}
                </button>
              </form>

              <div
                style={{
                  textAlign: 'center',
                  marginTop: '1.25rem',
                  fontSize: '0.9rem',
                  color: '#64748b'
                }}
              >
                Already have an account?{' '}
                <Link
                  to={roleFromPath ? `/${roleFromPath}/login` : '/login'}
                  style={{ fontWeight: 600 }}
                >
                  {t('login')}
                </Link>
              </div>
            </div>
          </div>
        )}

        <Link to="/" className="auth-home-link">
          ← {t('home')}
        </Link>
      </div>
    </div>
  );
}
