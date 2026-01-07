import { apiClient } from '@/lib/api/client';
import { getCurrentUserProfile } from './offlineStorage';

/**
 * Get current user's organization ID
 * First tries local storage, then falls back to backend API
 */
export async function getCurrentUserOrganizationId(): Promise<string> {
  try {
    // First try to get from local storage (faster)
    const localUserProfile = await getCurrentUserProfile();
    if (localUserProfile?.organizationId) {
      return localUserProfile.organizationId;
    }

    // If not in local storage, fetch from backend API
    const response = await apiClient.get<any>('/auth/profile');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Not authenticated');
    }

    const userProfile = response.data;
    
    if (!userProfile.organizationId) {
      throw new Error('User profile does not have an organization ID');
    }

    return userProfile.organizationId;
  } catch (error) {
    console.error('Error getting current user organization ID:', error);
    throw error;
  }
}

