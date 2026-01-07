import { config } from '@/config/env';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = config.API_BASE_URL;
const AUTH_TOKEN_KEY = 'ics-auth-token';
const REFRESH_TOKEN_KEY = 'ics-refresh-token';

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export class APIClient {
  /**
   * Get authentication token from AsyncStorage
   */
  public async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  /**
   * Get refresh token from AsyncStorage
   */
  public async getRefreshToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Error getting refresh token:', error);
      return null;
    }
  }

  /**
   * Store authentication tokens
   */
  public async setAuthTokens(accessToken: string, refreshToken?: string): Promise<void> {
    try {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, accessToken);
      if (refreshToken) {
        await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      }
    } catch (error) {
      console.error('Error storing auth tokens:', error);
    }
  }

  /**
   * Clear authentication tokens
   */
  public async clearAuthTokens(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY]);
    } catch (error) {
      console.error('Error clearing auth tokens:', error);
    }
  }

  /**
   * Get base URL
   */
  public getBaseUrl(): string {
    return API_BASE_URL;
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(): Promise<boolean> {
    try {
      const refreshToken = await this.getRefreshToken();
      if (!refreshToken) {
        return false;
      }

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        // Backend returns snake_case: access_token, refresh_token
        const accessToken = data.access_token || data.data?.access_token || data.data?.accessToken;
        const refreshToken = data.refresh_token || data.data?.refresh_token || data.data?.refreshToken;
        
        if (accessToken) {
          await this.setAuthTokens(accessToken, refreshToken);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
  }

  /**
   * Make API request with automatic token refresh
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = await this.getAuthToken();

    console.log(`[APIClient] Making request to: ${url}`);
    console.log(`[APIClient] Has token: ${!!token}`);

    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add auth header if token exists
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
      console.log(`[APIClient] Added Authorization header`);
    } else {
      console.warn(`[APIClient] No token available for request to ${endpoint}`);
    }

    try {
      let response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
      });

      // Handle 401 - try to refresh token and retry once
      if (response.status === 401 && token) {
        console.log('Token expired, attempting refresh...');
        const refreshed = await this.refreshAccessToken();
        
        if (refreshed) {
          // Retry request with new token
          const newToken = await this.getAuthToken();
          if (newToken) {
            defaultHeaders['Authorization'] = `Bearer ${newToken}`;
            response = await fetch(url, {
              ...options,
              headers: {
                ...defaultHeaders,
                ...options.headers,
              },
            });
          }
        } else {
          // Refresh failed, clear tokens and trigger logout
          await this.clearAuthTokens();
          // Dispatch event for auth context to handle
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth:unauthorized'));
          }
          
          return {
            success: false,
            error: 'Authentication required',
          };
        }
      }

      // Handle 204 No Content responses (empty body)
      if (response.status === 204) {
        return { success: true, data: undefined };
      }

      // Handle error responses - try to parse JSON, but handle non-JSON responses
      let data: any;
      const contentType = response.headers.get('content-type');
      
      try {
        if (contentType && contentType.includes('application/json')) {
          const text = await response.text();
          data = text ? JSON.parse(text) : {};
        } else {
          // If not JSON, read as text
          const text = await response.text();
          data = { message: text || `HTTP ${response.status}` };
        }
      } catch (parseError) {
        // If JSON parsing fails, create a generic error
        const text = await response.text().catch(() => '');
        data = { message: text || `HTTP ${response.status}` };
      }
      
      if (response.ok) {
        return { success: true, data };
      } else {
        // Handle 401 specifically - might not have token or token is invalid
        if (response.status === 401 && !token) {
          return {
            success: false,
            error: 'Authentication required. Please log in.',
          };
        }
        
        return {
          success: false,
          error: data.message || data.error || data.statusCode || `HTTP ${response.status}`,
        };
      }
    } catch (error: any) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: error.message || 'Network error occurred',
      };
    }
  }

  // HTTP Methods
  async get<T>(endpoint: string): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: any): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, data?: any): Promise<APIResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // Helper method for file uploads
  async upload<T>(endpoint: string, formData: FormData): Promise<APIResponse<T>> {
    const token = await this.getAuthToken();
    const headers: Record<string, string> = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (response.status === 401) {
        await this.clearAuthTokens();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }
        
        return {
          success: false,
          error: 'Authentication required',
        };
      }

      if (response.status === 204) {
        return { success: true, data: undefined };
      }

      const data = await response.json();
      
      if (response.ok) {
        return { success: true, data };
      } else {
        return {
          success: false,
          error: data.message || data.error || `HTTP ${response.status}`,
        };
      }
    } catch (error: any) {
      console.error('Upload failed:', error);
      return {
        success: false,
        error: error.message || 'Upload failed',
      };
    }
  }
}

// Export singleton instance
export const apiClient = new APIClient();

// Export for use in other API modules
export default apiClient;

