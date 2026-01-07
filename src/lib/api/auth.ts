import { User } from '@/types/dashboard';
import { apiClient } from './client';

interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  user: User;
}

interface LoginResult {
  success: boolean;
  error?: string;
  data?: LoginResponse;
}

interface BackendSession {
  accessToken: string;
  refreshToken?: string;
  user: User;
}

/**
 * Backend API-based authentication for React Native
 * All authentication is handled through the backend API
 */
class AuthAPI {
  /**
   * Sign in with email and password
   */
  async login(email: string, password: string): Promise<LoginResult> {
    try {
      const response = await apiClient.post<any>('/auth/login', {
        email,
        password,
      });

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || 'Invalid email or password',
        };
      }

      // Backend returns snake_case: access_token, refresh_token
      // Convert to camelCase for frontend
      const backendData = response.data;
      const accessToken = backendData.access_token || backendData.accessToken;
      const refreshToken = backendData.refresh_token || backendData.refreshToken;
      const user = backendData.user;

      if (!accessToken || !user) {
        return {
          success: false,
          error: 'Invalid response from server',
        };
      }

      // Store tokens
      await apiClient.setAuthTokens(accessToken, refreshToken);

      // Return in expected format
      return {
        success: true,
        data: {
          accessToken,
          refreshToken,
          user,
        },
      };
    } catch (error: any) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error.message || 'Login failed. Please try again.',
      };
    }
  }

  /**
   * Sign out
   */
  async logout(): Promise<{ success: boolean; error?: string }> {
    try {
      // Call backend logout endpoint
      await apiClient.post('/auth/logout', {});
      
      // Clear tokens
      await apiClient.clearAuthTokens();

      return { success: true };
    } catch (error: any) {
      console.error('Logout error:', error);
      // Clear tokens even if backend call fails
      await apiClient.clearAuthTokens();
      return { success: true };
    }
  }

  /**
   * Get current session (returns session-like object for compatibility)
   */
  async getSession(): Promise<BackendSession | null> {
    try {
      const token = await apiClient.getAuthToken();
      if (!token) {
        return null;
      }

      // Verify token is still valid by getting profile
      const user = await this.getProfile();
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
   * Get user profile
   */
  async getProfile(): Promise<User> {
    const response = await apiClient.get<User>('/auth/profile');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Not authenticated');
    }

    return response.data;
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: Partial<User>): Promise<User> {
    const response = await apiClient.patch<User>('/auth/profile', updates);
    
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
   * Listen to auth state changes (simulated for compatibility)
   * Note: Backend API doesn't have real-time subscriptions like Supabase
   * This is a simplified version that checks session periodically
   */
  onAuthStateChange(callback: (event: string, session: BackendSession | null) => void) {
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

export const authAPI = new AuthAPI();

