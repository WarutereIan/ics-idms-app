import { apiClient } from '@/lib/api/client';
import {
  getFormResponses,
  updateFormResponse,
  saveFormResponse,
  getMediaAttachmentsByResponse,
  saveMediaAttachment,
  getDownloadedForm,
  getCurrentUserProfile,
} from './offlineStorage';
import { generateUUID } from '@/lib/utils';
import { LocalFormResponse, LocalMediaAttachment } from '@/types/forms';
import * as FileSystem from 'expo-file-system';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: Array<{ responseId: string; error: string }>;
}

/**
 * Sync service for uploading form responses and media to backend API
 * Only syncs responses with status 'ready_to_send'
 */
export class SyncService {
  /**
   * Sync all ready-to-send form responses to the server
   */
  async syncReadyToSendResponses(): Promise<SyncResult> {
    const responses = await getFormResponses('ready_to_send');
    const result: SyncResult = {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      errors: [],
    };

    for (const response of responses) {
      try {
        // Mark as syncing
        await saveFormResponse({
          ...response,
          syncStatus: 'syncing',
        });

        // Upload media attachments first
        const mediaAttachments = await getMediaAttachmentsByResponse(response.id);
        const uploadedMediaUrls: Record<string, string> = {};

        for (const attachment of mediaAttachments) {
          if (!attachment.uploaded) {
            try {
              const uploadUrl = await this.uploadMediaFile(attachment);
              uploadedMediaUrls[attachment.questionId] = uploadUrl;
              
              // Update attachment
              await saveMediaAttachment({
                ...attachment,
                uploaded: true,
                uploadUrl,
                syncStatus: 'uploaded',
              });
            } catch (error) {
              console.error(`Failed to upload media ${attachment.id}:`, error);
              // Continue with other attachments, but mark this as failed
              await saveMediaAttachment({
                ...attachment,
                syncStatus: 'failed',
              });
              throw error; // Fail the entire response if media upload fails
            }
          } else if (attachment.uploadUrl) {
            uploadedMediaUrls[attachment.questionId] = attachment.uploadUrl;
          }
        }

        // Handle both old (separate responses with _repeatableMetadata) and new (single response with instance-scoped IDs) approaches
        const repeatableMetadata = response.data._repeatableMetadata;
        const sectionInstanceCounts = (response as any).sectionInstanceCounts;
        const responseDataWithoutMetadata = { ...response.data };
        
        // Remove metadata from response data before submitting question responses
        delete responseDataWithoutMetadata._repeatableMetadata;
        
        // Merge media URLs into response data
        const responseData = {
          ...responseDataWithoutMetadata,
          ...uploadedMediaUrls,
        };

        // Get downloaded form to validate question IDs (Supabase IDs)
        const downloadedForm = await getDownloadedForm(response.formId);
        if (!downloadedForm) {
          throw new Error(`Form ${response.formId} not found in downloaded forms`);
        }

        // Extract all valid Supabase question IDs from the form
        const validSupabaseQuestionIds = new Set<string>();
        downloadedForm.formData.sections.forEach(section => {
          section.questions.forEach(question => {
            validSupabaseQuestionIds.add(question.id);
          });
        });

        // Submit response to Supabase
        // Get user info for respondentId and organizationId from local storage
        const localUserProfile = await getCurrentUserProfile();
        if (!localUserProfile) {
          throw new Error('User profile not found in local storage. Please sign in again.');
        }

        // Get form version from downloaded form (already stored locally)
        const formVersion = downloadedForm.version;

        const responseId = response.id || generateUUID();
        const now = new Date().toISOString();

        // Detect if this response contains repeatable section data
        const hasRepeatableSections = sectionInstanceCounts && Object.keys(sectionInstanceCounts).length > 0;
        const isOldFormat = repeatableMetadata && repeatableMetadata.type === 'repeatable';
        
        if (hasRepeatableSections && !isOldFormat) {
          // New format: Single response with instance-scoped IDs - submit as single response with all data
          // Backend will handle the repeatable sections
          const sourceValue = JSON.stringify({
            type: 'repeatable',
            sectionInstanceCounts,
            originalSource: 'mobile_app'
          });
          
          await this.createSingleSupabaseResponse(response, responseData, downloadedForm, localUserProfile, responseId, formVersion, now, sourceValue);
          
          // Mark response as sent and synced
          await saveFormResponse({
            ...response,
            status: 'sent',
            syncStatus: 'synced',
            syncedAt: Date.now(),
          });
        } else if (isOldFormat) {
          // Old format: Single response representing one instance
          const sourceValue = JSON.stringify({
            type: 'repeatable',
            repeatableSectionId: repeatableMetadata.repeatableSectionId,
            instanceIndex: repeatableMetadata.instanceIndex,
            originalSource: repeatableMetadata.originalSource || 'mobile_app'
          });
          
          await this.createSingleSupabaseResponse(response, responseData, downloadedForm, localUserProfile, responseId, formVersion, now, sourceValue);
          
          // Mark response as sent and synced
          await saveFormResponse({
            ...response,
            status: 'sent',
            syncStatus: 'synced',
            syncedAt: Date.now(),
          });
        } else {
          // Regular single response (no repeatable sections)
          await this.createSingleSupabaseResponse(response, responseData, downloadedForm, localUserProfile, responseId, formVersion, now, 'mobile_app');
          
          // Mark response as sent and synced
          await saveFormResponse({
            ...response,
            status: 'sent',
            syncStatus: 'synced',
            syncedAt: Date.now(),
          });
        }

        result.syncedCount++;
      } catch (error) {
        console.error(`Failed to sync response ${response.id}:`, error);
        result.success = false;
        result.failedCount++;
        result.errors.push({
          responseId: response.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // Mark as failed
        await saveFormResponse({
          ...response,
          syncStatus: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Handle repeatable section response - submits multiple backend API responses from single local response
   */
  private async handleRepeatableSectionResponse(
    response: LocalFormResponse,
    sectionInstanceCounts: Record<string, number>,
    responseData: Record<string, any>,
    downloadedForm: any,
    localUserProfile: any,
    baseResponseId: string,
    formVersion: number,
    now: string
  ): Promise<void> {
    console.log('🔄 [SyncService] Handling repeatable section response:', {
      baseResponseId,
      sectionInstanceCounts,
      responseDataKeys: Object.keys(responseData)
    });

    // Find repeatable sections from the form
    const repeatableSections = downloadedForm.formData.sections.filter((section: any) => 
      (section as any).conditional?.repeatable === true
    );

    if (repeatableSections.length === 0) {
      console.warn('⚠️ [SyncService] No repeatable sections found in form, falling back to single response');
      await this.createSingleSupabaseResponse(response, responseData, downloadedForm, localUserProfile, baseResponseId, formVersion, now, 'mobile_app');
      return;
    }

    // Calculate max instances across all repeatable sections
    const maxInstances = Math.max(...Object.values(sectionInstanceCounts), 1);
    console.log('📊 [SyncService] Submitting', maxInstances, 'backend API responses for repeatable sections');

    for (let instanceIndex = 0; instanceIndex < maxInstances; instanceIndex++) {
      const instanceResponseId = `${baseResponseId}_i${instanceIndex}`;
      const instanceData: Record<string, any> = {};

      // Extract data for this instance
      downloadedForm.formData.sections.forEach((section: any) => {
        const isRepeatable = (section as any).conditional?.repeatable === true;
        
        section.questions.forEach((question: any) => {
          if (isRepeatable) {
            // For repeatable sections, use instance-scoped ID
            const instanceKey = `${question.id}__i${instanceIndex}`;
            if (responseData[instanceKey] !== undefined) {
              instanceData[question.id] = responseData[instanceKey];
            }
          } else {
            // For non-repeatable sections, use same value in all instances
            if (responseData[question.id] !== undefined) {
              instanceData[question.id] = responseData[question.id];
            }
          }
        });
      });

      // Only submit if there's actual data for this instance
      const hasData = Object.values(instanceData).some(value => 
        value !== undefined && value !== null && value !== ''
      );

      if (hasData) {
        console.log(`📝 [SyncService] Submitting backend API response ${instanceIndex + 1}/${maxInstances}:`, {
          instanceResponseId,
          dataKeys: Object.keys(instanceData)
        });

        const sourceValue = JSON.stringify({
          type: 'repeatable',
          repeatableSectionId: repeatableSections[0].id,
          instanceIndex: instanceIndex,
          originalSource: 'mobile_app'
        });

        await this.createSingleSupabaseResponse(
          response, 
          instanceData, 
          downloadedForm, 
          localUserProfile, 
          instanceResponseId, 
          formVersion, 
          now, 
          sourceValue
        );
      }
    }

    // Mark original response as sent and synced
    await saveFormResponse({
      ...response,
      status: 'sent',
      syncStatus: 'synced',
      syncedAt: Date.now(),
    });
  }

  /**
   * Create a single backend API response submission
   */
  private async createSingleSupabaseResponse(
    response: LocalFormResponse,
    responseData: Record<string, any>,
    downloadedForm: any,
    localUserProfile: any,
    responseId: string,
    formVersion: number,
    now: string,
    sourceValue: string
  ): Promise<void> {
    // Extract all valid question IDs from the form
    const validQuestionIds = new Set<string>();
    downloadedForm.formData.sections.forEach((section: any) => {
      section.questions.forEach((question: any) => {
        validQuestionIds.add(question.id);
      });
    });

    // Process response data - strip instance suffixes and filter valid question IDs
    const processedData: Record<string, any> = {};
    
    Object.entries(responseData).forEach(([questionId, value]) => {
      if (value === null || value === undefined || value === '') return;
      
      // Strip instance suffix if present (e.g., "questionId__i0" -> "questionId")
      const baseQuestionId = questionId.replace(/__i\d+$/, '');
      
      if (!validQuestionIds.has(baseQuestionId)) {
        console.warn(`⚠️ [SyncService] Skipping invalid question ID: ${questionId} (base: ${baseQuestionId})`);
        return;
      }
      
      // Use base question ID as key, keep first non-null value
      if (!(baseQuestionId in processedData)) {
        processedData[baseQuestionId] = value;
      }
    });

    console.log('📋 [SyncService] Submitting response to backend API:', {
      formId: response.formId,
      questionCount: Object.keys(processedData).length,
      isComplete: response.isComplete,
    });

    // Submit to backend API
    const apiResponse = await apiClient.post('/forms/responses', {
      formId: response.formId,
      respondentId: localUserProfile.userId,
      respondentEmail: localUserProfile.email,
      isComplete: response.isComplete,
      source: sourceValue,
      data: processedData,
    });

    if (!apiResponse.success) {
      throw new Error(apiResponse.error || 'Failed to submit form response');
    }

    console.log('✅ [SyncService] Successfully submitted response to backend API');
  }

  /**
   * Upload a media file to backend API
   * Note: For now, we'll include media as base64 in response data
   * TODO: Implement proper file upload endpoint if backend supports it
   */
  private async uploadMediaFile(attachment: LocalMediaAttachment): Promise<string> {
    // Read file as base64
    const fileContent = await FileSystem.readAsStringAsync(attachment.filePath, {
      encoding: 'base64',
    });

    // For now, return a data URI that can be included in response data
    // The backend can handle base64 data URIs in the response
    const dataUri = `data:${attachment.fileType};base64,${fileContent}`;
    
    // TODO: If backend has a dedicated media upload endpoint, use it here
    // For now, return the data URI which will be included in the response submission
    return dataUri;
  }

  /**
   * Convert base64 string to Blob
   */
  private async base64ToBlob(base64: string, contentType: string): Promise<Blob> {
    // For React Native, we need to use fetch to create a blob
    const response = await fetch(`data:${contentType};base64,${base64}`);
    return await response.blob();
  }

  /**
   * Sync a single response (for manual retry)
   */
  async syncSingleResponse(responseId: string): Promise<{ success: boolean; error?: string }> {
    const responses = await getFormResponses('ready_to_send');
    const targetResponse = responses.find((r) => r.id === responseId);

    if (!targetResponse) {
      return {
        success: false,
        error: 'Response not found or not ready to send',
      };
    }

    try {
      // Mark as syncing
      await saveFormResponse({
        ...targetResponse,
        syncStatus: 'syncing',
      });

      // Upload media attachments first
      const mediaAttachments = await getMediaAttachmentsByResponse(targetResponse.id);
      const uploadedMediaUrls: Record<string, string> = {};

      for (const attachment of mediaAttachments) {
        if (!attachment.uploaded) {
          try {
            const uploadUrl = await this.uploadMediaFile(attachment);
            uploadedMediaUrls[attachment.questionId] = uploadUrl;
            
            // Update attachment
            await saveMediaAttachment({
              ...attachment,
              uploaded: true,
              uploadUrl,
              syncStatus: 'uploaded',
            });
          } catch (error) {
            console.error(`Failed to upload media ${attachment.id}:`, error);
            await saveMediaAttachment({
              ...attachment,
              syncStatus: 'failed',
            });
            throw error;
          }
        } else if (attachment.uploadUrl) {
          uploadedMediaUrls[attachment.questionId] = attachment.uploadUrl;
        }
      }

      // Handle response data similar to main sync method
      const repeatableMetadata = targetResponse.data._repeatableMetadata;
      const sectionInstanceCounts = (targetResponse as any).sectionInstanceCounts;
      const responseDataWithoutMetadata = { ...targetResponse.data };
      
      delete responseDataWithoutMetadata._repeatableMetadata;
      
      const responseData = {
        ...responseDataWithoutMetadata,
        ...uploadedMediaUrls,
      };

      // Get downloaded form
      const downloadedForm = await getDownloadedForm(targetResponse.formId);
      if (!downloadedForm) {
        throw new Error(`Form ${targetResponse.formId} not found in downloaded forms`);
      }

      // Get user profile
      const localUserProfile = await getCurrentUserProfile();
      if (!localUserProfile) {
        throw new Error('User profile not found in local storage. Please sign in again.');
      }

      const formVersion = downloadedForm.version;
      const responseId = targetResponse.id || generateUUID();
      const now = new Date().toISOString();

      // Detect format and sync accordingly
      const hasRepeatableSections = sectionInstanceCounts && Object.keys(sectionInstanceCounts).length > 0;
      const isOldFormat = repeatableMetadata && repeatableMetadata.type === 'repeatable';
      
      if (hasRepeatableSections && !isOldFormat) {
        await this.handleRepeatableSectionResponse(targetResponse, sectionInstanceCounts, responseData, downloadedForm, localUserProfile, responseId, formVersion, now);
      } else if (isOldFormat) {
        const sourceValue = JSON.stringify({
          type: 'repeatable',
          repeatableSectionId: repeatableMetadata.repeatableSectionId,
          instanceIndex: repeatableMetadata.instanceIndex,
          originalSource: repeatableMetadata.originalSource || 'mobile_app'
        });
        
        await this.createSingleSupabaseResponse(targetResponse, responseData, downloadedForm, localUserProfile, responseId, formVersion, now, sourceValue);
        
        await saveFormResponse({
          ...targetResponse,
          status: 'sent',
          syncStatus: 'synced',
          syncedAt: Date.now(),
        });
      } else {
        await this.createSingleSupabaseResponse(targetResponse, responseData, downloadedForm, localUserProfile, responseId, formVersion, now, 'mobile_app');
        
        await saveFormResponse({
          ...targetResponse,
          status: 'sent',
          syncStatus: 'synced',
          syncedAt: Date.now(),
        });
      }

      return { success: true };
    } catch (error) {
      console.error(`Failed to sync single response ${responseId}:`, error);
      
      await saveFormResponse({
        ...targetResponse,
        syncStatus: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get sync status summary
   */
  async getSyncStatus(): Promise<{
    readyToSendCount: number;
    syncingCount: number;
    failedCount: number;
  }> {
    const readyToSend = await getFormResponses('ready_to_send');
    const syncingCount = readyToSend.filter((r) => r.syncStatus === 'syncing').length;
    const failedCount = readyToSend.filter((r) => r.syncStatus === 'failed').length;

    return {
      readyToSendCount: readyToSend.length,
      syncingCount,
      failedCount,
    };
  }
}

export const syncService = new SyncService();

