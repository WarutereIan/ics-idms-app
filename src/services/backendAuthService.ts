import { apiClient } from '@/lib/api/client';
import type { User } from '@/types/dashboard';

/**
 * Backend API-based authentication service for React Native
 * Handles authentication, user data queries, and profile management
 */
class BackendAuthService {
  /**
   * Sign in with email and password using backend API
   */
  async signIn(email: string, password: string): Promise<{
    user: User | null;
    error: Error | null;
  }> {
    try {
      const response = await apiClient.post<any>('/auth/login', {
        email,
        password,
      });

      if (!response.success || !response.data) {
        return {
          user: null,
          error: new Error(response.error || 'Invalid email or password'),
        };
      }

      // Backend returns snake_case: access_token, refresh_token
      const backendData = response.data;
      const accessToken = backendData.access_token || backendData.accessToken;
      const refreshToken = backendData.refresh_token || backendData.refreshToken;
      const user = backendData.user;

      if (!accessToken || !user) {
        return {
          user: null,
          error: new Error('Invalid response from server'),
        };
      }

      // Store tokens
      await apiClient.setAuthTokens(accessToken, refreshToken);

      return {
        user,
        error: null,
      };
    } catch (error: any) {
      return {
        user: null,
        error: error instanceof Error ? error : new Error(error.message || 'Login failed'),
      };
    }
  }

  /**
   * Sign out using backend API
   */
  async signOut(): Promise<{ error: Error | null }> {
    try {
      // Call backend logout endpoint
      await apiClient.post('/auth/logout', {});
      
      // Clear tokens
      await apiClient.clearAuthTokens();

      return { error: null };
    } catch (error: any) {
      // Clear tokens even if backend call fails
      await apiClient.clearAuthTokens();
      return {
        error: error instanceof Error ? error : new Error(error.message || 'Logout failed'),
      };
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const token = await apiClient.getAuthToken();
      if (!token) {
        return null;
      }

      const response = await apiClient.get<User>('/auth/profile');
      if (!response.success || !response.data) {
        return null;
      }

      return response.data;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  /**
   * Get user profile by user ID
   */
  async getUserProfile(userId: string): Promise<User | null> {
    try {
      const response = await apiClient.get<User>(`/users/${userId}`);
      if (!response.success || !response.data) {
        return null;
      }

      return response.data;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    const response = await apiClient.patch<User>(`/users/${userId}`, updates);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to update profile');
    }

    return response.data;
  }

  /**
   * Change password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const response = await apiClient.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to change password');
    }
  }

  /**
   * Get current session (for compatibility)
   * Returns a session-like object
   */
  async getSession(): Promise<any> {
    try {
      const token = await apiClient.getAuthToken();
      if (!token) {
        return null;
      }

      const user = await this.getCurrentUser();
      if (!user) {
        return null;
      }

      const refreshToken = await apiClient.getRefreshToken();
      return {
        accessToken: token,
        refreshToken: refreshToken || undefined,
        user,
      };
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  /**
   * Listen to auth state changes (simulated for compatibility)
   * Note: Backend API doesn't have real-time subscriptions like Supabase
   * This is a simplified version that checks session periodically
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    // Check session on mount
    this.getSession().then((session) => {
      if (session) {
        callback('SIGNED_IN', session);
      } else {
        callback('SIGNED_OUT', null);
      }
    });

    // Return a subscription-like object for compatibility
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            // No-op for backend API
          },
        },
      },
    };
  }
}

export const backendAuthService = new BackendAuthService();

