import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import ErrorMessage from '../components/ErrorMessage';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Login() {
  const { t } = useTranslation();
  const { signIn, role: currentRole, error: authError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const roleFromPath = location.pathname.startsWith('/customer')
    ? 'customer'
    : location.pathname.startsWith('/worker')
    ? 'worker'
    : null;

  const [role, setRole] = useState(roleFromPath || 'customer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (roleFromPath) {
      setRole(roleFromPath);
    }
  }, [roleFromPath]);

  const handleRoleSwitch = (newRole) => {
    setRole(newRole);
    setLocalError('');
    if (location.pathname.startsWith('/customer') || location.pathname.startsWith('/worker')) {
      navigate(`/${newRole}/login`, { replace: true });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!email || !password) {
      setLocalError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    const targetRole = role;
    const { data, error } = await signIn({ email, password, role: targetRole });
    setIsSubmitting(false);

    if (error) {
      setLocalError(error.message || 'Authentication failed. Please check your credentials.');
      return;
    }

    // Role-based redirect strictly into the selected profile workspace
    const targetDashboard = targetRole === 'worker' ? '/worker/dashboard' : '/customer/dashboard';
    const returnUrl = location.state?.from?.pathname;
    const redirectPath =
      returnUrl && returnUrl.startsWith(`/${targetRole}`) ? returnUrl : targetDashboard;
    navigate(redirectPath, { replace: true });
  };

  const isCustomer = role === 'customer';

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
        <div className="auth-card">
          <div className="card">
            <div className="card-header" style={{ textAlign: 'center' }}>
              <h2 className="card-title" style={{ fontSize: '1.5rem', color: isCustomer ? '#173f3d' : 'var(--primary)' }}>
                WorkLink
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                {isCustomer ? `${t('customer')} ${t('login')}` : `${t('worker')} ${t('login')}`}
              </p>
            </div>

            {/* Role Switcher Tabs */}
            <div className="auth-role-switcher" role="tablist" aria-label="Select login profile">
              <button
                type="button"
                role="tab"
                aria-selected={isCustomer}
                className={`auth-role-tab ${isCustomer ? 'active customer' : ''}`}
                onClick={() => handleRoleSwitch('customer')}
              >
                <span>🏢</span>
                <span>{t('customer')}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!isCustomer}
                className={`auth-role-tab ${!isCustomer ? 'active worker' : ''}`}
                onClick={() => handleRoleSwitch('worker')}
              >
                <span>👷</span>
                <span>{t('worker')}</span>
              </button>
            </div>

            {/* Prominent Profile Indicator Banner */}
            {isCustomer ? (
              <div className="auth-profile-indicator customer" role="status">
                <div className="indicator-avatar" aria-hidden="true">🏢</div>
                <div className="indicator-text">
                  <strong>{t('customerProfileLogin')}</strong>
                  <p>{t('customerLoginDesc')}</p>
                </div>
                <span className="indicator-tag">{t('customer')}</span>
              </div>
            ) : (
              <div className="auth-profile-indicator worker" role="status">
                <div className="indicator-avatar" aria-hidden="true">👷</div>
                <div className="indicator-text">
                  <strong>{t('workerProfileLogin')}</strong>
                  <p>{t('workerLoginDesc')}</p>
                </div>
                <span className="indicator-tag">{t('worker')}</span>
              </div>
            )}

            {(localError || authError) && <ErrorMessage message={localError || authError} />}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">
                  {isCustomer ? `${t('customer')} ${t('email')}` : `${t('worker')} ${t('email')}`}
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                  placeholder={isCustomer ? 'e.g. customer@example.com' : 'e.g. worker@example.com'}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="login-password">
                  {t('password')}
                </label>
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`btn btn-primary ${isCustomer ? 'btn-customer-auth' : ''}`}
                style={{ width: '100%', marginTop: '0.5rem' }}
              >
                {isSubmitting
                  ? t('loading')
                  : isCustomer
                  ? `${t('loginToCustomerProfile')} →`
                  : `${t('loginToWorkerProfile')} →`}
              </button>
            </form>

            <div className="auth-alt-prompt">
              {isCustomer ? (
                <p>
                  Looking for daily work?{' '}
                  <button
                    type="button"
                    onClick={() => handleRoleSwitch('worker')}
                    className="auth-switch-link"
                  >
                    Switch to Worker Login
                  </button>
                </p>
              ) : (
                <p>
                  Need to hire workers?{' '}
                  <button
                    type="button"
                    onClick={() => handleRoleSwitch('customer')}
                    className="auth-switch-link"
                  >
                    Switch to Customer Login
                  </button>
                </p>
              )}
            </div>

            <div
              style={{
                textAlign: 'center',
                marginTop: '1.25rem',
                fontSize: '0.9rem',
                color: '#64748b'
              }}
            >
              Don't have an account?{' '}
              <Link to={`/${role}/register`} style={{ fontWeight: 600 }}>
                {t('register')}
              </Link>
            </div>
          </div>
        </div>
        <Link to="/" className="auth-home-link">
          ← {t('home')}
        </Link>
      </div>
    </div>
  );
}
