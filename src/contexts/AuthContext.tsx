import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { User } from '@/types/dashboard';
import { authAPI } from '@/lib/api/auth';
import { saveUserProfile, clearUserProfile } from '@/services/offlineStorage';

// Backend session type (compatible with Supabase Session structure)
interface BackendSession {
  accessToken: string;
  refreshToken?: string;
  user: User;
}

interface AuthContextType {
  user: User | null;
  session: BackendSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isRefreshing: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<User>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

interface LoginResult {
  success: boolean;
  error?: string;
  user?: User;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<BackendSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const sessionRef = useRef<BackendSession | null>(null);
  sessionRef.current = session;

  const isRefreshingRef = useRef(false);
  const lastValidSessionRef = useRef<BackendSession | null>(null);
  const lastRefreshTimeRef = useRef<number>(0);
  const SESSION_REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes

  const isAuthenticated = !!user && !!session;

  // Initialize auth state on mount
  useEffect(() => {
    initializeAuth();
    
    // Listen to auth state changes
    const { data: { subscription } } = authAPI.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      
      if (event === 'SIGNED_IN' && session) {
        setSession(session);
        lastValidSessionRef.current = session;
        lastRefreshTimeRef.current = Date.now();
        // Fetch user profile
        try {
          const userProfile = await authAPI.getProfile();
          setUser(userProfile);
          // Save user profile to local storage for offline sync
          // organizationId is optional for single-organization systems
          if (userProfile && userProfile.id) {
            try {
              await saveUserProfile(userProfile.id, userProfile.id, userProfile.organizationId, userProfile.email);
              console.log('AuthContext - User profile saved to local storage for sync');
            } catch (saveError) {
              console.error('Error saving user profile to local storage:', saveError);
              // Don't throw - auth can still work without local storage, but sync will fail
            }
          }
        } catch (error) {
          console.error('Error fetching user profile after sign in:', error);
        }
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        lastValidSessionRef.current = null;
        lastRefreshTimeRef.current = 0;
        // Clear user profile from local storage
        try {
          await clearUserProfile();
          console.log('AuthContext - User profile cleared from local storage');
        } catch (error) {
          console.error('Error clearing user profile from local storage:', error);
          // Don't throw - sign out should still succeed
        }
      } else if (event === 'TOKEN_REFRESHED' && session) {
        setSession(session);
        lastValidSessionRef.current = session;
        lastRefreshTimeRef.current = Date.now();
        isRefreshingRef.current = false;
        setIsRefreshing(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Refresh session periodically and on app state change
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const refreshSessionIfNeeded = async () => {
      const now = Date.now();
      const timeSinceLastRefresh = now - lastRefreshTimeRef.current;
      
      if (timeSinceLastRefresh < SESSION_REFRESH_INTERVAL) {
        return;
      }

      if (isRefreshingRef.current) {
        return;
      }

      console.log('AuthContext - Refreshing session');
      isRefreshingRef.current = true;
      setIsRefreshing(true);
      lastRefreshTimeRef.current = now;
      
      try {
        const currentSession = await authAPI.getSession();
        
        if (currentSession) {
          setSession(currentSession);
          lastValidSessionRef.current = currentSession;
          
          try {
            const userProfile = await authAPI.getProfile();
            setUser(userProfile);
            // Update user profile in local storage for offline sync
            // organizationId is optional for single-organization systems
            if (userProfile && userProfile.id) {
              try {
                await saveUserProfile(userProfile.id, userProfile.id, userProfile.organizationId, userProfile.email);
              } catch (saveError) {
                console.error('Error saving user profile to local storage:', saveError);
                // Don't throw - auth can still work without local storage, but sync will fail
              }
            }
          } catch (error) {
            console.error('Error refreshing user profile:', error);
          }
        }
      } catch (error) {
        console.error('Error refreshing session:', error);
      } finally {
        isRefreshingRef.current = false;
        setIsRefreshing(false);
      }
    };

    // Handle app state change (foreground/background)
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        refreshSessionIfNeeded();
      }
    };

    // Set up periodic refresh
    const intervalId = setInterval(() => {
      refreshSessionIfNeeded();
    }, SESSION_REFRESH_INTERVAL);

    // Listen to app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, [isAuthenticated]);

  const initializeAuth = async () => {
    console.log('AuthContext - initializeAuth called');
    
    try {
      const currentSession = await authAPI.getSession();
      console.log('AuthContext - currentSession found:', !!currentSession);
      
      if (currentSession) {
        setSession(currentSession);
        lastValidSessionRef.current = currentSession;
        lastRefreshTimeRef.current = Date.now();
        
        try {
          const userProfile = await authAPI.getProfile();
          console.log('AuthContext - user profile loaded');
          setUser(userProfile);
          // Save user profile to local storage for offline sync
          // organizationId is optional for single-organization systems
          if (userProfile && userProfile.id) {
            try {
              await saveUserProfile(userProfile.id, userProfile.id, userProfile.organizationId, userProfile.email);
              console.log('AuthContext - User profile saved to local storage for sync');
            } catch (saveError) {
              console.error('Error saving user profile to local storage:', saveError);
              // Don't throw - auth can still work without local storage, but sync will fail
            }
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      } else {
        setSession(null);
        setUser(null);
        lastValidSessionRef.current = null;
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<LoginResult> => {
    setIsLoading(true);
    
    try {
      const result = await authAPI.login(email, password);
      
      if (result.success && result.data) {
        const { accessToken, refreshToken, user: userProfile } = result.data;
        
        // Create session object
        const newSession: BackendSession = {
          accessToken,
          refreshToken,
          user: userProfile,
        };
        
        setSession(newSession);
        setUser(userProfile);
        lastValidSessionRef.current = newSession;
        lastRefreshTimeRef.current = Date.now();
        
        // Save user profile to local storage for offline sync
        // organizationId is optional for single-organization systems
        if (userProfile && userProfile.id) {
          try {
            await saveUserProfile(userProfile.id, userProfile.id, userProfile.organizationId, userProfile.email);
            console.log('AuthContext - User profile saved to local storage after login');
          } catch (saveError) {
            console.error('Error saving user profile to local storage:', saveError);
            // Don't throw - auth can still work without local storage, but sync will fail
          }
        }
        
        return { success: true, user: userProfile };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error: any) {
      console.error('Login failed:', error);
      return { 
        success: false, 
        error: error.message || 'Login failed. Please try again.' 
      };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    // Sign out from backend API
    authAPI.logout().catch(console.error);
    
    // Clear local state
    setSession(null);
    setUser(null);
    lastValidSessionRef.current = null;
    lastRefreshTimeRef.current = 0;
    
        // Clear user profile from local storage
        try {
          await clearUserProfile();
          console.log('AuthContext - User profile cleared from local storage on logout');
        } catch (error) {
          console.error('Error clearing user profile from local storage:', error);
          // Don't throw - logout should still succeed
        }
  };

  const updateProfile = async (updates: Partial<User>): Promise<User> => {
    try {
      const updatedUser = await authAPI.updateProfile(updates);
      setUser(updatedUser);
      return updatedUser;
    } catch (error) {
      console.error('Profile update failed:', error);
      throw error;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    try {
      await authAPI.changePassword(currentPassword, newPassword);
    } catch (error) {
      console.error('Password change failed:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      isAuthenticated,
      isRefreshing,
      login,
      logout,
      updateProfile,
      changePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;

