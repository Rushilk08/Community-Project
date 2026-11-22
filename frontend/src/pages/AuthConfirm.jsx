import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';

export default function AuthConfirm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState('Verifying your email confirmation...');

  useEffect(() => {
    let mounted = true;

    const searchParams = new URLSearchParams(location.search);
    const urlRole = searchParams.get('role');
    const pendingRole = urlRole || localStorage.getItem('worklink_pending_role') || localStorage.getItem('worksetu_pending_role') || 'customer';

    function redirectToRole(session) {
      const finalRole =
        session?.user?.user_metadata?.role ||
        urlRole ||
        (session?.user?.id && (localStorage.getItem(`worklink_role_${session.user.id}`) || localStorage.getItem(`worksetu_role_${session.user.id}`))) ||
        pendingRole;

      if (session?.user?.id) {
        localStorage.setItem(`worklink_role_${session.user.id}`, finalRole);
      }
      localStorage.removeItem('worklink_pending_role');
      localStorage.removeItem('worksetu_pending_role');

      const dest = finalRole === 'worker' ? '/worker/dashboard' : '/customer/dashboard';
      if (mounted) {
        setStatus('Email confirmed! Taking you to your workspace...');
        setTimeout(() => {
          if (mounted) navigate(dest, { replace: true });
        }, 500);
      }
    }

    // PRIMARY: listen for the SIGNED_IN event that Supabase fires after
    // it exchanges the hash token (detectSessionInUrl: true handles the exchange)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (
        (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') &&
        session?.user
      ) {
        redirectToRole(session);
      }
    });

    // SECONDARY: session may already exist if user revisits this page
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted || !session?.user) return;
      redirectToRole(session);
    });

    // SAFETY FALLBACK: if nothing fires within 10 s, go to login
    const fallbackTimer = setTimeout(() => {
      if (mounted) {
        navigate(`/${pendingRole}/login`, { replace: true });
      }
    }, 10000);

    return () => {
      mounted = false;
      subscription?.unsubscribe();
      clearTimeout(fallbackTimer);
    };
  }, []); // run once on mount

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-card">
          <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1.25rem' }}>🎉</div>
            <h2 style={{ fontSize: '1.5rem', color: '#173f3d', marginBottom: '0.5rem' }}>
              Email Confirmed!
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: '320px', margin: '0 auto' }}>
              {status}
            </p>
            <div style={{ marginTop: '2rem' }}>
              <div className="loading-spinner" style={{ margin: '0 auto' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
