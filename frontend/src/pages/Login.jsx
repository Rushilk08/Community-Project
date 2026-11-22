import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import ErrorMessage from '../components/ErrorMessage';

export default function Login() {
  const { t } = useTranslation();
  const { signIn, role: currentRole, error: authError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const roleFromPath = location.pathname.startsWith('/customer') ? 'customer'
    : location.pathname.startsWith('/worker') ? 'worker'
    : null;
  const expectedRoleLabel = roleFromPath === 'customer' ? 'Customer' : roleFromPath === 'worker' ? 'Worker' : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!email || !password) {
      setLocalError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    const { data, error } = await signIn({ email, password });
    setIsSubmitting(false);

    if (error) {
      setLocalError(error.message || 'Authentication failed. Please check your credentials.');
      return;
    }

    // Role-based redirect
    const userRole = data?.user?.user_metadata?.role || currentRole || 'worker';
    const redirectPath = location.state?.from?.pathname || (userRole === 'customer' ? '/customer/dashboard' : '/worker/dashboard');
    navigate(redirectPath, { replace: true });
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
      <Link to="/" className="public-brand auth-brand"><span className="brand-mark">WS</span><span>WorkSetu</span></Link>
      <div className="auth-card">
      <div className="card">
        <div className="card-header" style={{ textAlign: 'center' }}>
          <h2 className="card-title" style={{ fontSize: '1.5rem', color: '#1e40af' }}>WorkSetu</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            {expectedRoleLabel ? `${expectedRoleLabel} ${t('login')}` : t('login')}
          </p>
        </div>

        {(localError || authError) && (
          <ErrorMessage message={localError || authError} />
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              {t('email')}
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              placeholder="e.g. worker@example.com"
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
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {isSubmitting ? t('loading') : t('login')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.9rem', color: '#64748b' }}>
          Don't have an account?{' '}
          <Link to={roleFromPath ? `/${roleFromPath}/register` : '/register'} style={{ fontWeight: 600 }}>
            {t('register')}
          </Link>
        </div>
      </div>
      </div>
      </div>
    </div>
  );
}
