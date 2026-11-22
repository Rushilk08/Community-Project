import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';

/**
 * Root role redirector:
 * Automatically routes authenticated users to their corresponding dashboard,
 * or sends unauthenticated visitors to /login.
 */
export default function RoleRedirect() {
  const { user, role, loading, isAuthenticated } = useAuth();

  if (loading) {
    return <Loading message="Loading WorkLink..." />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const effectiveRole =
    role ||
    user?.user_metadata?.role ||
    sessionStorage.getItem(`worklink_role_${user.id}`) ||
    sessionStorage.getItem(`worksetu_role_${user.id}`) ||
    localStorage.getItem(`worklink_role_${user.id}`) ||
    localStorage.getItem(`worksetu_role_${user.id}`);

  if (effectiveRole === 'customer') {
    return <Navigate to="/customer/dashboard" replace />;
  }

  if (effectiveRole === 'worker') {
    return <Navigate to="/worker/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
}
