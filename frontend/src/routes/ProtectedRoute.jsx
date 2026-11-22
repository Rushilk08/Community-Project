import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';

/**
 * Route protection wrapper:
 * 1. Checks if user is authenticated. If not, redirects to /login.
 * 2. Checks if user role matches allowedRoles. If not, redirects to their assigned dashboard.
 */
export default function ProtectedRoute({ allowedRoles = [], children }) {
  const { user, role, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loading message="Verifying authentication..." />;
  }

  // Not authenticated -> redirect to login preserving intent
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Determine effective role with metadata/sessionStorage fallback
  const effectiveRole =
    role ||
    user?.user_metadata?.role ||
    sessionStorage.getItem(`worklink_role_${user.id}`) ||
    sessionStorage.getItem(`worksetu_role_${user.id}`) ||
    localStorage.getItem(`worklink_role_${user.id}`) ||
    localStorage.getItem(`worksetu_role_${user.id}`);

  // If specific roles required, verify user's role
  if (allowedRoles.length > 0 && (!effectiveRole || !allowedRoles.includes(effectiveRole))) {
    console.warn(`[ProtectedRoute] Access denied for role '${effectiveRole}'. Required: ${allowedRoles.join(', ')}`);
    // Redirect to the user's correct dashboard
    if (effectiveRole === 'customer') {
      return <Navigate to="/customer/dashboard" replace />;
    } else if (effectiveRole === 'worker') {
      return <Navigate to="/worker/dashboard" replace />;
    } else {
      return <Navigate to="/login" replace />;
    }
  }

  return children;
}
