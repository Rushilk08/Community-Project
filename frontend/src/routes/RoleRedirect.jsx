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
    return <Loading message="Loading WorkSetu..." />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (role === 'customer') {
    return <Navigate to="/customer/dashboard" replace />;
  }

  if (role === 'worker') {
    return <Navigate to="/worker/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
}
