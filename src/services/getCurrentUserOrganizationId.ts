import { apiClient } from '@/lib/api/client';
import { getCurrentUserProfile, saveUserProfile } from './offlineStorage';

/**
 * Get current user's organization ID
 * First tries local storage, then falls back to backend API
 * Automatically saves profile to local storage if fetched from API
 */
export async function getCurrentUserOrganizationId(): Promise<string> {
  try {
    // First try to get from local storage (faster)
    // getCurrentUserProfile now has fallback to API, so this should work
    const localUserProfile = await getCurrentUserProfile();
    if (localUserProfile?.organizationId) {
      return localUserProfile.organizationId;
    }

    // If still not available, fetch from backend API directly
    const response = await apiClient.get<any>('/auth/profile');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Not authenticated');
    }

    const userProfile = response.data;
    
    // For single-organization systems, organizationId may not exist
    // Return empty string as default
    const organizationId = userProfile.organizationId || '';

    // Save to local storage for future use
    if (userProfile.id) {
      try {
        await saveUserProfile(
          userProfile.id,
          userProfile.id,
          organizationId, // May be empty string for single-org systems
          userProfile.email
        );
        console.log('✅ [getCurrentUserOrganizationId] Saved user profile to local storage');
      } catch (saveError) {
        console.warn('⚠️ [getCurrentUserOrganizationId] Failed to save profile to local storage:', saveError);
        // Don't throw - we still have the organizationId to return
      }
    }

    return organizationId;
  } catch (error) {
    console.error('Error getting current user organization ID:', error);
    throw error;
  }
}

