import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helper to extract role from user object or profile metadata
  const extractUserRole = (authUser) => {
    if (!authUser) return null;
    return (
      authUser.user_metadata?.role ||
      authUser.app_metadata?.role ||
      localStorage.getItem(`worksetu_role_${authUser.id}`) ||
      null
    );
  };

  // Sync state with current session
  const syncAuthState = async (currentSession) => {
    try {
      if (!currentSession?.user) {
        setUser(null);
        setSession(null);
        setRole(null);
        setLoading(false);
        return;
      }

      const authUser = currentSession.user;
      setSession(currentSession);
      setUser(authUser);

      let detectedRole = extractUserRole(authUser);

      // If role not directly in metadata and Supabase is configured, check profiles table
      if (!detectedRole && isSupabaseConfigured) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', authUser.id)
            .single();

          if (profile?.role) {
            detectedRole = profile.role;
          }
        } catch (dbErr) {
          console.warn('[AuthContext] Could not query profiles table:', dbErr.message);
        }
      }

      // Default fallback if unspecified
      detectedRole = detectedRole || 'worker';
      setRole(detectedRole);
      localStorage.setItem(`worksetu_role_${authUser.id}`, detectedRole);
    } catch (err) {
      console.error('[AuthContext] Error syncing auth state:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Check existing session
    const initAuth = async () => {
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (mounted) {
          await syncAuthState(existingSession);
        }
      } catch (err) {
        console.warn('[AuthContext] Session initialization warning:', err.message);
        if (mounted) {
          // If Supabase not fully connected, check local fallback session for mock dev
          const localUser = localStorage.getItem('worksetu_mock_user');
          if (localUser) {
            try {
              const parsed = JSON.parse(localUser);
              setUser(parsed);
              setRole(parsed.role || 'customer');
            } catch (_) {}
          }
          setLoading(false);
        }
      }
    };

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (mounted) {
          await syncAuthState(newSession);
        }
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  /**
   * Register a new user with Supabase Auth
   */
  const signUp = async ({ email, password, role: userRole = 'worker', fullName, phone, metadata = {} }) => {
    setError(null);
    setLoading(true);

    try {
      if (!isSupabaseConfigured) {
        // Mock register fallback for local dev when keys are not configured yet
        const mockUser = {
          id: `user-${Date.now()}`,
          email,
          user_metadata: { role: userRole, full_name: fullName, phone, ...metadata }
        };
        localStorage.setItem('worksetu_mock_user', JSON.stringify(mockUser));
        localStorage.setItem(`worksetu_role_${mockUser.id}`, userRole);
        setUser(mockUser);
        setRole(userRole);
        setLoading(false);
        return { data: { user: mockUser }, error: null };
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: userRole,
            full_name: fullName,
            phone,
            ...metadata
          }
        }
      });

      if (signUpError) throw signUpError;

      if (data.user) {
        localStorage.setItem(`worksetu_role_${data.user.id}`, userRole);
        setRole(userRole);
      }

      return { data, error: null };
    } catch (err) {
      console.error('[AuthContext] signUp error:', err);
      setError(err.message);
      return { data: null, error: err };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Log in user with email and password
   */
  const signIn = async ({ email, password }) => {
    setError(null);
    setLoading(true);

    try {
      if (!isSupabaseConfigured) {
        // Mock sign in fallback for developer testing
        const roleFromEmail = email.toLowerCase().includes('customer') ? 'customer' : 'worker';
        const mockUser = {
          id: `user-${Date.now()}`,
          email,
          user_metadata: { role: roleFromEmail, full_name: email.split('@')[0] }
        };
        localStorage.setItem('worksetu_mock_user', JSON.stringify(mockUser));
        localStorage.setItem(`worksetu_role_${mockUser.id}`, roleFromEmail);
        setUser(mockUser);
        setRole(roleFromEmail);
        setLoading(false);
        return { data: { user: mockUser }, error: null };
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) throw signInError;

      if (data.user) {
        const userRole = extractUserRole(data.user) || 'worker';
        setRole(userRole);
      }

      return { data, error: null };
    } catch (err) {
      console.error('[AuthContext] signIn error:', err);
      setError(err.message);
      return { data: null, error: err };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sign out current user
   */
  const signOut = async () => {
    setError(null);
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('[AuthContext] signOut error:', err.message);
    } finally {
      localStorage.removeItem('worksetu_mock_user');
      setUser(null);
      setSession(null);
      setRole(null);
    }
  };

  /**
   * Get the current authenticated user
   */
  const getCurrentUser = () => {
    return user;
  };

  /**
   * Force refresh active session
   */
  const refreshSession = async () => {
    try {
      if (isSupabaseConfigured) {
        const { data, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) throw refreshError;
        await syncAuthState(data.session);
        return data.session;
      }
      return session;
    } catch (err) {
      console.error('[AuthContext] refreshSession error:', err);
      return null;
    }
  };

  const clearError = () => setError(null);

  const value = {
    user,
    session,
    role,
    loading,
    error,
    signUp,
    signIn,
    signOut,
    getCurrentUser,
    refreshSession,
    clearError,
    isAuthenticated: Boolean(user)
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
