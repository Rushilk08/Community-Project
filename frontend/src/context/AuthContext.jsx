import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';

const AuthContext = createContext(null);

// Purge legacy mock user data from developer testing so no one is logged in automatically
if (typeof window !== 'undefined') {
  localStorage.removeItem('worksetu_mock_user');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
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
      localStorage.getItem(`worksetu_role_${authUser.email}`) ||
      null
    );
  };

  // Helper to fetch complete user profile from Supabase profiles database table
  const fetchUserProfile = async (userId) => {
    if (!isSupabaseConfigured || !userId) return null;
    try {
      const { data, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!profileErr && data) {
        return data;
      }
    } catch (err) {
      console.warn('[AuthContext] Error fetching profile from database:', err.message);
    }
    return null;
  };

  // Sync state with current session and load full user data
  const syncAuthState = async (currentSession) => {
    try {
      if (!currentSession?.user) {
        setUser(null);
        setProfile(null);
        setSession(null);
        setRole(null);
        setLoading(false);
        return;
      }

      const authUser = currentSession.user;
      setSession(currentSession);

      // 1. Fetch complete profile data from Supabase 'profiles' database table
      let userProfile = await fetchUserProfile(authUser.id);

      // 2. If profile record does not exist in DB yet, create or upsert it
      if (!userProfile && isSupabaseConfigured) {
        const initialRole = extractUserRole(authUser) || 'customer';
        const initialData = {
          id: authUser.id,
          email: authUser.email || '',
          role: initialRole,
          full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
          phone: authUser.user_metadata?.phone || '',
          skill: authUser.user_metadata?.skill || null,
          location: authUser.user_metadata?.location || 'Bengaluru, Karnataka',
          organization: authUser.user_metadata?.organization || null
        };
        try {
          const { data: inserted, error: insertErr } = await supabase
            .from('profiles')
            .upsert(initialData)
            .select()
            .single();
          if (!insertErr && inserted) {
            userProfile = inserted;
          }
        } catch (e) {
          console.warn('[AuthContext] Profile auto-creation fallback:', e.message);
        }
      }

      // 3. Merge DB profile data into user object so all components have instant access
      const detectedRole = userProfile?.role || extractUserRole(authUser) || 'customer';
      const mergedMetadata = {
        ...(authUser.user_metadata || {}),
        ...(userProfile || {}),
        role: detectedRole
      };

      const completeUser = {
        ...authUser,
        user_metadata: mergedMetadata
      };

      setUser(completeUser);
      setProfile(userProfile || mergedMetadata);
      setRole(detectedRole);
      localStorage.setItem(`worksetu_role_${authUser.id}`, detectedRole);
      localStorage.setItem(`worksetu_role_${authUser.email}`, detectedRole);
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
        if (!isSupabaseConfigured) {
          // In offline mode without Supabase, check if a registered session was explicitly active
          const localUser = localStorage.getItem('worksetu_active_user');
          if (localUser && mounted) {
            try {
              const parsed = JSON.parse(localUser);
              setUser(parsed);
              setProfile(parsed.profile || parsed.user_metadata || parsed);
              const savedRole =
                localStorage.getItem(`worksetu_role_${parsed.id}`) ||
                parsed.user_metadata?.role ||
                parsed.role ||
                'customer';
              setRole(savedRole);
            } catch (_) {}
          }
          if (mounted) setLoading(false);
          return;
        }

        // With live Supabase, check real authenticated session
        const {
          data: { session: existingSession }
        } = await supabase.auth.getSession();
        if (mounted) {
          await syncAuthState(existingSession);
        }
      } catch (err) {
        console.warn('[AuthContext] Session initialization warning:', err.message);
        if (mounted) {
          setUser(null);
          setProfile(null);
          setSession(null);
          setRole(null);
          setLoading(false);
        }
      }
    };

    initAuth();

    // Listen for auth state changes from Supabase
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (mounted) {
        await syncAuthState(newSession);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  /**
   * Register a new user with Supabase Auth and initialize their database profile
   */
  const signUp = async ({
    email,
    password,
    role: userRole = 'worker',
    fullName,
    phone,
    metadata = {}
  }) => {
    setError(null);
    setLoading(true);

    try {
      if (!isSupabaseConfigured) {
        // Fallback for offline mode: save to registered users store
        const registeredUsers = JSON.parse(localStorage.getItem('worksetu_registered_users') || '[]');
        if (registeredUsers.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
          throw new Error('An account with this email already exists. Please log in.');
        }

        const newUser = {
          id: `user-${Date.now()}`,
          email,
          password,
          role: userRole,
          full_name: fullName,
          phone,
          user_metadata: { role: userRole, full_name: fullName, phone, ...metadata }
        };
        registeredUsers.push(newUser);
        localStorage.setItem('worksetu_registered_users', JSON.stringify(registeredUsers));
        localStorage.setItem('worksetu_active_user', JSON.stringify(newUser));
        localStorage.setItem(`worksetu_role_${newUser.id}`, userRole);
        localStorage.setItem(`worksetu_role_${email}`, userRole);

        setUser(newUser);
        setProfile(newUser.user_metadata);
        setRole(userRole);
        setLoading(false);
        return { data: { user: newUser }, error: null };
      }

      // Configure confirmation redirect URL
      const redirectUrl = `${window.location.origin}/auth/confirm?role=${userRole}`;

      // Real Supabase registration
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            role: userRole,
            full_name: fullName,
            phone,
            ...metadata
          }
        }
      });

      if (signUpError) throw signUpError;

      // Detect if Supabase sent a verification email (session is null when email confirmation is active)
      const isEmailConfirmationRequired = Boolean(data.user && !data.session);

      if (data.user) {
        localStorage.setItem('worksetu_pending_role', userRole);

        // Ensure profile is created in public.profiles table
        const profileRecord = {
          id: data.user.id,
          email,
          role: userRole,
          full_name: fullName,
          phone,
          skill: userRole === 'worker' ? metadata.skill || 'General Labour' : null,
          location: metadata.location || 'Bengaluru, Karnataka',
          organization:
            userRole === 'customer' ? metadata.organization || 'Individual / Household' : null
        };

        try {
          const { data: dbProfile } = await supabase
            .from('profiles')
            .upsert(profileRecord)
            .select()
            .single();
          if (dbProfile) {
            setProfile(dbProfile);
          } else {
            setProfile(profileRecord);
          }
        } catch (pErr) {
          console.warn('[AuthContext] Manual profile upsert warning:', pErr.message);
          setProfile(profileRecord);
        }

        localStorage.setItem(`worksetu_role_${data.user.id}`, userRole);
        localStorage.setItem(`worksetu_role_${email}`, userRole);
        setRole(userRole);
      }

      return { data, error: null, isEmailConfirmationRequired, role: userRole };
    } catch (err) {
      console.error('[AuthContext] signUp error:', err);
      setError(err.message);
      return { data: null, error: err };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Log in user with email and password, strictly requiring a registered account
   */
  const signIn = async ({ email, password, role: preferredRole }) => {
    setError(null);
    setLoading(true);

    try {
      if (!isSupabaseConfigured) {
        // In offline mode: verify that this email was previously registered!
        const registeredUsers = JSON.parse(localStorage.getItem('worksetu_registered_users') || '[]');
        const existingUser = registeredUsers.find(
          (u) => u.email.toLowerCase() === email.toLowerCase()
        );

        if (!existingUser) {
          throw new Error('No registered account found with this email. Please register first.');
        }

        if (existingUser.password !== password) {
          throw new Error('Incorrect password. Please try again.');
        }

        const activeRole = preferredRole || existingUser.role || 'customer';
        existingUser.role = activeRole;
        if (existingUser.user_metadata) existingUser.user_metadata.role = activeRole;

        localStorage.setItem('worksetu_active_user', JSON.stringify(existingUser));
        localStorage.setItem(`worksetu_role_${existingUser.id}`, activeRole);
        localStorage.setItem(`worksetu_role_${email}`, activeRole);

        setUser(existingUser);
        setProfile(existingUser.user_metadata || existingUser);
        setRole(activeRole);
        setLoading(false);
        return { data: { user: existingUser }, error: null };
      }

      // Real Supabase authentication: strictly verifies credentials against auth.users
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) throw signInError;

      if (data.user) {
        // Fetch complete profile from Supabase database upon login
        let userProfile = await fetchUserProfile(data.user.id);

        // Prioritize the role the user explicitly selected on the login page
        let userRole =
          preferredRole ||
          userProfile?.role ||
          extractUserRole(data.user) ||
          'customer';

        // When user explicitly selects Worker or Customer profile, update profiles table to match
        if (preferredRole && userProfile && userProfile.role !== preferredRole) {
          try {
            await supabase
              .from('profiles')
              .update({ role: preferredRole })
              .eq('id', data.user.id);
            userProfile.role = preferredRole;
          } catch (updateErr) {
            console.warn('[AuthContext] Could not update profile role to preferred role:', updateErr.message);
          }
        }

        // If profile was missing from database table, populate it now
        if (!userProfile) {
          const newProfile = {
            id: data.user.id,
            email: data.user.email,
            role: userRole,
            full_name:
              data.user.user_metadata?.full_name ||
              data.user.email?.split('@')[0] ||
              'User',
            phone: data.user.user_metadata?.phone || '',
            skill: data.user.user_metadata?.skill || null,
            location: data.user.user_metadata?.location || 'Bengaluru, Karnataka',
            organization: data.user.user_metadata?.organization || null
          };
          try {
            const { data: upserted } = await supabase
              .from('profiles')
              .upsert(newProfile)
              .select()
              .single();
            if (upserted) userProfile = upserted;
          } catch (_) {}
        }

        const mergedMetadata = {
          ...(data.user.user_metadata || {}),
          ...(userProfile || {}),
          role: userRole
        };

        const completeUser = {
          ...data.user,
          user_metadata: mergedMetadata
        };

        setUser(completeUser);
        setProfile(userProfile || mergedMetadata);
        setRole(userRole);
        localStorage.setItem(`worksetu_role_${data.user.id}`, userRole);
        localStorage.setItem(`worksetu_role_${email}`, userRole);
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
   * Update profile metadata across database table and auth metadata
   */
  const updateProfile = async (updates = {}) => {
    try {
      if (!user) return { data: null, error: new Error('No authenticated user') };

      const updatedMetadata = {
        ...(user.user_metadata || {}),
        ...updates
      };

      const updatedUser = {
        ...user,
        user_metadata: updatedMetadata
      };

      setUser(updatedUser);
      setProfile((prev) => ({ ...(prev || {}), ...updates }));

      if (!isSupabaseConfigured) {
        localStorage.setItem('worksetu_active_user', JSON.stringify(updatedUser));
        return { data: { user: updatedUser }, error: null };
      }

      // Update Supabase profiles table
      try {
        await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id);
      } catch (dbErr) {
        console.warn('[AuthContext] Error updating profiles table:', dbErr.message);
      }

      // Update Supabase Auth user metadata
      const { data, error: updateError } = await supabase.auth.updateUser({
        data: updatedMetadata
      });

      if (updateError) throw updateError;
      if (data?.user) {
        setUser({
          ...data.user,
          user_metadata: {
            ...data.user.user_metadata,
            ...updatedMetadata
          }
        });
      }
      return { data, error: null };
    } catch (err) {
      console.error('[AuthContext] updateProfile error:', err);
      return { data: null, error: err };
    }
  };

  /**
   * Sign out current user and clear all auth states
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
      localStorage.removeItem('worksetu_active_user');
      localStorage.removeItem('worksetu_mock_user');
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('worksetu_role_') || key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      });
      setUser(null);
      setProfile(null);
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
    profile,
    session,
    role,
    loading,
    error,
    signUp,
    signIn,
    updateProfile,
    signOut,
    getCurrentUser,
    refreshSession,
    clearError,
    isSupabaseConfigured,
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
