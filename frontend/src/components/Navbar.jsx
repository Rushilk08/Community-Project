import React from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';

export default function Navbar() {
  const { t } = useTranslation();
  const { user, role, signOut, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname === '/' || location.pathname.includes('/login') || location.pathname.includes('/register')) {
    return null;
  }

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const isCustomer = role === 'customer' || location.pathname.startsWith('/customer');
  const isWorker = !isCustomer && (role === 'worker' || location.pathname.startsWith('/worker'));

  const getDashboardPath = () => {
    if (isCustomer) return '/customer/dashboard';
    if (isWorker) return '/worker/dashboard';
    return '/';
  };

  return (
    <header className="navbar">
      {/* Brand logo & name */}
      <Link to={getDashboardPath()} className="nav-brand">
        <div className="nav-brand-logo">WS</div>
        <span>WorkSetu</span>
      </Link>

      {/* Navigation links based on role */}
      <nav>
        <ul className="nav-links">
          {isAuthenticated ? (
            <>
              {isCustomer && (
                <>
                  <li>
                    <NavLink to="/customer/dashboard" className="nav-link">
                      {t('dashboard')}
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/customer/post-job" className="nav-link">
                      {t('postJob')}
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/customer/my-jobs" className="nav-link">
                      {t('myJobs')}
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/customer/live-hiring" className="nav-link">
                      {t('liveHiring')}
                    </NavLink>
                  </li>
                </>
              )}

              {isWorker && (
                <>
                  <li>
                    <NavLink to="/worker/dashboard" className="nav-link">
                      {t('dashboard')}
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/worker/job-offers" className="nav-link">
                      {t('jobOffers')}
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/worker/my-jobs" className="nav-link">
                      {t('myJobs')}
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to="/worker/groups" className="nav-link">
                      {t('workerGroups')}
                    </NavLink>
                  </li>
                </>
              )}

              <li>
                <NavLink
                  to={isCustomer ? '/customer/profile' : '/worker/profile'}
                  className="nav-link"
                >
                  {t('profile')}
                </NavLink>
              </li>
            </>
          ) : (
            <>
              <li>
                <NavLink to="/login" className="nav-link">
                  {t('login')}
                </NavLink>
              </li>
              <li>
                <NavLink to="/register" className="nav-link">
                  {t('register')}
                </NavLink>
              </li>
            </>
          )}
        </ul>
      </nav>

      {/* Right side actions: Language Switcher, User badge, Logout */}
      <div className="nav-actions">
        <LanguageSwitcher />

        {isAuthenticated && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              className={`badge ${isCustomer ? 'badge-neutral' : 'badge-success'}`}
              title={user?.email}
            >
              {isCustomer ? t('customer') : t('worker')}
            </span>

            <button
              onClick={handleLogout}
              className="btn btn-outline btn-sm"
              title={t('logout')}
            >
              {t('logout')}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
