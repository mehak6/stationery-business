'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../../supabase_client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: 'admin' | 'salesperson' | 'pending' | null;
  accessLoading: boolean;
  accessError: string | null;
  refreshAccess: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'admin' | 'salesperson' | 'pending' | null>(null);
  const [accessUserId, setAccessUserId] = useState<string | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  const refreshAccess = async () => {
    setAccessLoading(true);
    setRole(null);
    setAccessError(null);
    if (!user) { setAccessUserId(null); setAccessLoading(false); return; }
    const { data, error } = await (supabase.rpc as any)('get_app_access');
    setAccessUserId(user.id);
    if (error) setAccessError('Access setup is unavailable. Ask the admin to complete the database update.');
    else setRole(data === 'admin' || data === 'salesperson' ? data : 'pending');
    setAccessLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      setAccessLoading(true); setRole(null); setAccessError(null);
      if (!user) { setAccessUserId(null); setAccessLoading(false); return; }
      const { data, error } = await (supabase.rpc as any)('get_app_access');
      if (cancelled) return;
      setAccessUserId(user.id);
      if (error) setAccessError('Access setup is unavailable. Ask the admin to complete the database update.');
      else setRole(data === 'admin' || data === 'salesperson' ? data : 'pending');
      setAccessLoading(false);
    };
    void check();
    window.addEventListener('focus', check);
    return () => { cancelled = true; window.removeEventListener('focus', check); };
  }, [user]);

  useEffect(() => {
    // Discard the legacy service-worker API response cache, never offline edits.
    if ('caches' in window) void caches.delete('supabase-assets');
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((error) => {
      console.error('Error getting session:', error);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    if (role === 'admin') {
      const { cleanupSyncManager } = await import('../../lib/sync-manager');
      cleanupSyncManager();
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    // Clear loaded admin components and background timers on shared counters.
    window.location.reload();
  };

  const value = {
    user,
    session,
    loading,
    role: accessUserId === user?.id ? role : null,
    accessLoading: accessLoading || (!!user && accessUserId !== user.id),
    accessError,
    refreshAccess,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
