import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Form, DownloadedForm, LocalFormResponse, FormResponseStatus } from '@/types/forms';
import { backendFormsService } from '@/services/backendFormsService';
import {
  saveDownloadedForm,
  getDownloadedForms,
  getDownloadedFormsByProject,
  getDownloadedForm,
  deleteDownloadedForm,
  saveFormResponse,
  getFormResponses,
  getFormResponse,
  updateFormResponse,
  deleteFormResponse,
  getResponseCounts,
} from '@/services/offlineStorage';
import { useAuth } from './AuthContext';
import { useNetwork } from './NetworkContext';
import { generateUUID } from '@/lib/utils';

interface FormContextType {
  // Downloaded forms
  downloadedForms: DownloadedForm[];
  formsByProject: Record<string, { project: { id: string; name: string }; forms: DownloadedForm[] }>;
  isLoadingForms: boolean;
  refreshDownloadedForms: () => Promise<void>;
  
  // Form download
  downloadForm: (form: Form, projectName?: string) => Promise<void>;
  deleteForm: (formId: string) => Promise<void>;
  getForm: (formId: string) => Promise<DownloadedForm | null>;
  
  // Form responses
  responses: {
    drafts: LocalFormResponse[];
    readyToSend: LocalFormResponse[];
    sent: LocalFormResponse[];
  };
  responseCounts: {
    drafts: number;
    readyToSend: number;
    sent: number;
  };
  isLoadingResponses: boolean;
  refreshResponses: () => Promise<void>;
  
  // Response management
  createResponse: (formId: string, data: Record<string, any>, status?: FormResponseStatus) => Promise<LocalFormResponse>;
  updateResponse: (responseId: string, data: Record<string, any>) => Promise<void>;
  updateResponseStatus: (responseId: string, status: FormResponseStatus) => Promise<void>;
  deleteResponse: (responseId: string) => Promise<void>;
  getResponse: (responseId: string) => Promise<LocalFormResponse | null>;
  
  // Fetch accessible forms from server
  fetchAccessibleForms: () => Promise<Record<string, { project: { id: string; name: string }; forms: Form[] }>>;
}

const FormContext = createContext<FormContextType | undefined>(undefined);

interface FormProviderProps {
  children: ReactNode;
}

export function FormProvider({ children }: FormProviderProps) {
  const { isAuthenticated } = useAuth();
  const { isConnected } = useNetwork();
  
  const [downloadedForms, setDownloadedForms] = useState<DownloadedForm[]>([]);
  const [isLoadingForms, setIsLoadingForms] = useState(false);
  const [isLoadingResponses, setIsLoadingResponses] = useState(false);
  
  const [responses, setResponses] = useState<{
    drafts: LocalFormResponse[];
    readyToSend: LocalFormResponse[];
    sent: LocalFormResponse[];
  }>({
    drafts: [],
    readyToSend: [],
    sent: [],
  });
  
  const [responseCounts, setResponseCounts] = useState({
    drafts: 0,
    readyToSend: 0,
    sent: 0,
  });

  // Group downloaded forms by project
  const formsByProject = React.useMemo(() => {
    const grouped: Record<string, { project: { id: string; name: string }; forms: DownloadedForm[] }> = {};
    
    downloadedForms.forEach((form) => {
      if (!grouped[form.projectId]) {
        grouped[form.projectId] = {
          project: { id: form.projectId, name: form.projectName || 'Unknown Project' },
          forms: [],
        };
      }
      grouped[form.projectId].forms.push(form);
    });
    
    return grouped;
  }, [downloadedForms]);

  // Load downloaded forms
  const refreshDownloadedForms = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    setIsLoadingForms(true);
    try {
      const forms = await getDownloadedForms();
      setDownloadedForms(forms);
    } catch (error) {
      console.error('Error loading downloaded forms:', error);
    } finally {
      setIsLoadingForms(false);
    }
  }, [isAuthenticated]);

  // Load form responses
  const refreshResponses = useCallback(async () => {
    console.log('🔄 [FormContext.refreshResponses] Starting to refresh responses...');
    
    if (!isAuthenticated) {
      console.log('❌ [FormContext.refreshResponses] User not authenticated, skipping');
      return;
    }

    setIsLoadingResponses(true);
    try {
      console.log('📋 [FormContext.refreshResponses] Loading responses by status...');
      const [drafts, readyToSend, sent] = await Promise.all([
        getFormResponses('draft'),
        getFormResponses('ready_to_send'),
        getFormResponses('sent'),
      ]);

      console.log('📊 [FormContext.refreshResponses] Responses loaded:', {
        draftsCount: drafts.length,
        readyToSendCount: readyToSend.length,
        sentCount: sent.length,
        draftsSample: drafts.slice(0, 2).map(r => ({
          id: r.id,
          formTitle: r.formTitle,
          dataKeys: Object.keys(r.data || {}),
          status: r.status,
          createdAt: r.createdAt
        })),
        readyToSendSample: readyToSend.slice(0, 2).map(r => ({
          id: r.id,
          formTitle: r.formTitle,
          dataKeys: Object.keys(r.data || {}),
          status: r.status,
          createdAt: r.createdAt
        }))
      });

      setResponses({
        drafts,
        readyToSend,
        sent,
      });

      // Update counts
      const counts = await getResponseCounts();
      console.log('📊 [FormContext.refreshResponses] Response counts:', counts);
      setResponseCounts(counts);
      
      console.log('✅ [FormContext.refreshResponses] Responses refreshed successfully');
    } catch (error) {
      console.error('❌ [FormContext.refreshResponses] Error loading form responses:', error);
      console.error('[FormContext.refreshResponses] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    } finally {
      setIsLoadingResponses(false);
    }
  }, [isAuthenticated]);

  // Load data on mount and when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      refreshDownloadedForms();
      refreshResponses();
    } else {
      setDownloadedForms([]);
      setResponses({ drafts: [], readyToSend: [], sent: [] });
      setResponseCounts({ drafts: 0, readyToSend: 0, sent: 0 });
    }
  }, [isAuthenticated, refreshDownloadedForms, refreshResponses]);

  // Download form to device
  const downloadForm = useCallback(async (form: Form, projectName?: string) => {
    try {
      await saveDownloadedForm(form, projectName);
      await refreshDownloadedForms();
    } catch (error) {
      console.error('Error downloading form:', error);
      throw error;
    }
  }, [refreshDownloadedForms]);

  // Delete downloaded form
  const deleteForm = useCallback(async (formId: string) => {
    try {
      await deleteDownloadedForm(formId);
      await refreshDownloadedForms();
    } catch (error) {
      console.error('Error deleting form:', error);
      throw error;
    }
  }, [refreshDownloadedForms]);

  // Get downloaded form
  const getForm = useCallback(async (formId: string): Promise<DownloadedForm | null> => {
    try {
      return await getDownloadedForm(formId);
    } catch (error) {
      console.error('Error getting form:', error);
      return null;
    }
  }, []);

  // Fetch accessible forms from server
  const fetchAccessibleForms = useCallback(async (): Promise<Record<string, { project: { id: string; name: string }; forms: Form[] }>> => {
    console.log('[FormContext] fetchAccessibleForms called');
    console.log('[FormContext] Network connected:', isConnected);
    
    if (!isConnected) {
      console.error('[FormContext] No internet connection, cannot fetch forms');
      throw new Error('No internet connection');
    }

    try {
      console.log('[FormContext] Calling backendFormsService.getAccessibleForms()...');
      const formsByProject = await backendFormsService.getAccessibleForms();
      console.log('[FormContext] Received formsByProject, project count:', Object.keys(formsByProject).length);
      
      // Transform to Form[] format (without the downloaded form metadata)
      const transformed: Record<string, { project: { id: string; name: string }; forms: Form[] }> = {};
      
      Object.entries(formsByProject).forEach(([projectId, data]) => {
        console.log(`[FormContext] Transforming project ${data.project.name} (${projectId}) with ${data.forms.length} forms`);
        transformed[projectId] = {
          project: data.project,
          forms: data.forms.map((form) => ({
            id: form.id,
            title: form.title,
            description: form.description,
            projectId: form.projectId,
            projectName: form.projectName,
            createdBy: form.createdBy,
            createdAt: form.createdAt,
            updatedAt: form.updatedAt,
            status: form.status,
            version: form.version,
            sections: form.sections || [],
            settings: form.settings,
            responseCount: form.responseCount,
            lastResponseAt: form.lastResponseAt,
            tags: form.tags,
            category: form.category,
          })),
        };
      });
      
      console.log('[FormContext] Final transformed result:');
      Object.entries(transformed).forEach(([projectId, data]) => {
        console.log(`[FormContext]   Project ${data.project.name}: ${data.forms.length} forms`);
      });
      
      return transformed;
    } catch (error) {
      console.error('[FormContext] Error fetching accessible forms:', error);
      console.error('[FormContext] Error details:', error instanceof Error ? {
        message: error.message,
        stack: error.stack,
      } : error);
      throw error;
    }
  }, [isConnected]);

  // Create form response
  const createResponse = useCallback(async (
    formId: string,
    data: Record<string, any>,
    status: FormResponseStatus = 'draft'
  ): Promise<LocalFormResponse> => {
    const responseId = generateUUID();
    const now = Date.now();

    console.log('🔄 [FormContext.createResponse] Creating new response:', {
      responseId,
      formId,
      status,
      dataKeys: Object.keys(data),
      dataCount: Object.keys(data).length,
      sampleData: Object.entries(data).slice(0, 3).reduce((acc, [key, value]) => {
        acc[key] = typeof value === 'object' ? JSON.stringify(value).substring(0, 100) : value;
        return acc;
      }, {} as Record<string, any>)
    });

    // Get form title for display
    const form = await getDownloadedForm(formId);
    const formTitle = form?.title || 'Unknown Form';
    console.log('📋 [FormContext.createResponse] Form details:', { formTitle, foundForm: !!form });

    const response: LocalFormResponse = {
      id: responseId,
      formId,
      formTitle,
      data,
      status,
      isComplete: status === 'ready_to_send',
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    };

    console.log('💾 [FormContext.createResponse] Response object created:', {
      id: response.id,
      formId: response.formId,
      formTitle: response.formTitle,
      dataKeys: Object.keys(response.data),
      status: response.status,
      isComplete: response.isComplete,
      syncStatus: response.syncStatus
    });

    try {
      console.log('💾 [FormContext.createResponse] Saving response to storage...');
      await saveFormResponse(response);
      console.log('🔄 [FormContext.createResponse] Refreshing responses list...');
      await refreshResponses();
      console.log('✅ [FormContext.createResponse] Response created successfully');
      return response;
    } catch (error) {
      console.error('❌ [FormContext.createResponse] Error creating response:', error);
      console.error('[FormContext.createResponse] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        responseId,
        formId,
        status
      });
      throw error;
    }
  }, [refreshResponses]);

  // Update form response
  const updateResponse = useCallback(async (responseId: string, data: Record<string, any>) => {
    console.log('🔄 [FormContext.updateResponse] Updating response:', {
      responseId,
      dataKeys: Object.keys(data),
      dataCount: Object.keys(data).length,
      sampleData: Object.entries(data).slice(0, 3).reduce((acc, [key, value]) => {
        acc[key] = typeof value === 'object' ? JSON.stringify(value).substring(0, 100) : value;
        return acc;
      }, {} as Record<string, any>)
    });

    try {
      console.log('🔍 [FormContext.updateResponse] Getting existing response...');
      const existingResponse = await getFormResponse(responseId);
      if (!existingResponse) {
        console.error('❌ [FormContext.updateResponse] Response not found:', responseId);
        throw new Error('Response not found');
      }

      console.log('📋 [FormContext.updateResponse] Existing response found:', {
        id: existingResponse.id,
        formId: existingResponse.formId,
        formTitle: existingResponse.formTitle,
        existingDataKeys: Object.keys(existingResponse.data || {}),
        status: existingResponse.status,
        createdAt: existingResponse.createdAt,
        updatedAt: existingResponse.updatedAt
      });

      // Extract form response data from the update payload
      // The data parameter may contain metadata fields (formTitle, data, conditionalData, etc.)
      // We need to extract just the form question responses
      const formData = (data as any).data || data; // If data.data exists, use that, otherwise use data directly
      const conditionalData = (data as any).conditionalData || {};
      
      // Merge form data and conditional data
      const mergedFormData = { ...formData, ...conditionalData };
      
      // Extract other metadata fields if they exist
      const formTitle = (data as any).formTitle || existingResponse.formTitle;
      const isComplete = (data as any).isComplete !== undefined ? (data as any).isComplete : existingResponse.isComplete;
      const status = (data as any).status || existingResponse.status;
      const currentSectionIndex = (data as any).currentSectionIndex;
      const sectionInstanceCounts = (data as any).sectionInstanceCounts;

      console.log('🔄 [FormContext.updateResponse] Extracting data:', {
        hasDataField: !!(data as any).data,
        formDataKeys: Object.keys(formData),
        conditionalDataKeys: Object.keys(conditionalData),
        mergedDataKeys: Object.keys(mergedFormData),
        formTitle,
        isComplete,
        status,
        currentSectionIndex,
        sectionInstanceCounts: sectionInstanceCounts ? Object.keys(sectionInstanceCounts) : []
      });

      const updated: any = {
        ...existingResponse,
        formTitle,
        data: mergedFormData, // Store only the actual form question responses
        status: status as FormResponseStatus,
        isComplete,
        updatedAt: Date.now(),
      };
      
      // Add metadata fields if provided
      if (conditionalData && Object.keys(conditionalData).length > 0) {
        updated.conditionalData = conditionalData;
      }
      if (currentSectionIndex !== undefined) {
        updated.currentSectionIndex = currentSectionIndex;
      }
      if (sectionInstanceCounts && Object.keys(sectionInstanceCounts).length > 0) {
        updated.sectionInstanceCounts = sectionInstanceCounts;
      }

      console.log('💾 [FormContext.updateResponse] Updated response object:', {
        id: updated.id,
        formId: updated.formId,
        formTitle: updated.formTitle,
        dataKeys: Object.keys(updated.data || {}),
        status: updated.status,
        isComplete: updated.isComplete,
        updatedAt: updated.updatedAt
      });

      console.log('💾 [FormContext.updateResponse] Saving updated response...');
      await saveFormResponse(updated);
      console.log('🔄 [FormContext.updateResponse] Refreshing responses list...');
      await refreshResponses();
      console.log('✅ [FormContext.updateResponse] Response updated successfully');
    } catch (error) {
      console.error('❌ [FormContext.updateResponse] Error updating response:', error);
      console.error('[FormContext.updateResponse] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        responseId
      });
      throw error;
    }
  }, [refreshResponses]);

  // Update response status
  const updateResponseStatusCallback = useCallback(async (responseId: string, status: FormResponseStatus) => {
    console.log('🔄 [FormContext.updateResponseStatus] Updating response status:', {
      responseId,
      newStatus: status
    });

    try {
      console.log('🔍 [FormContext.updateResponseStatus] Getting existing response...');
      const existingResponse = await getFormResponse(responseId);
      if (!existingResponse) {
        console.error('❌ [FormContext.updateResponseStatus] Response not found:', responseId);
        throw new Error('Response not found');
      }

      console.log('📋 [FormContext.updateResponseStatus] Existing response found:', {
        id: existingResponse.id,
        currentStatus: existingResponse.status,
        newStatus: status
      });

      console.log('💾 [FormContext.updateResponseStatus] Updating status in storage...');
      await updateFormResponse({ id: responseId, status, updatedAt: Date.now() });
      console.log('🔄 [FormContext.updateResponseStatus] Refreshing responses list...');
      await refreshResponses();
      console.log('✅ [FormContext.updateResponseStatus] Status updated successfully');
    } catch (error) {
      console.error('❌ [FormContext.updateResponseStatus] Error updating response status:', error);
      console.error('[FormContext.updateResponseStatus] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        responseId,
        status
      });
      throw error;
    }
  }, [refreshResponses]);

  // Delete form response
  const deleteResponse = useCallback(async (responseId: string) => {
    try {
      await deleteFormResponse(responseId);
      await refreshResponses();
    } catch (error) {
      console.error('Error deleting response:', error);
      throw error;
    }
  }, [refreshResponses]);

  // Get form response
  const getResponse = useCallback(async (responseId: string): Promise<LocalFormResponse | null> => {
    try {
      return await getFormResponse(responseId);
    } catch (error) {
      console.error('Error getting response:', error);
      return null;
    }
  }, []);

  const value: FormContextType = {
    downloadedForms,
    formsByProject,
    isLoadingForms,
    refreshDownloadedForms,
    downloadForm,
    deleteForm,
    getForm,
    responses,
    responseCounts,
    isLoadingResponses,
    refreshResponses,
    createResponse,
    updateResponse,
    updateResponseStatus: updateResponseStatusCallback,
    deleteResponse,
    getResponse,
    fetchAccessibleForms,
  };

  return (
    <FormContext.Provider value={value}>
      {children}
    </FormContext.Provider>
  );
}

export function useForm(): FormContextType {
  const context = useContext(FormContext);
  if (context === undefined) {
    throw new Error('useForm must be used within a FormProvider');
  }
  return context;
}

export default FormContext;

