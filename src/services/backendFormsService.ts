import { apiClient } from '@/lib/api/client';
import { Form, FormSection, FormQuestion } from '@/types/forms';

// Extended types with nested relations
type FormWithSections = Form & {
  sections?: (FormSection & {
    questions?: FormQuestion[];
  })[];
};

/**
 * Backend API forms service for mobile app
 * Fetches forms accessible to the user based on organization and project permissions
 */
class BackendFormsService {
  /**
   * Get all accessible projects for the current user
   * Returns projects where user has access
   */
  async getUserAccessibleProjects(): Promise<Array<{ id: string; name: string }>> {
    try {
      console.log('[BackendFormsService] Starting getUserAccessibleProjects...');
      
      const response = await apiClient.get<Array<{ id: string; name: string }>>('/projects');
      
      if (!response.success || !response.data) {
        console.error('[BackendFormsService] Failed to fetch projects:', response.error);
        throw new Error(response.error || 'Failed to fetch projects');
      }

      console.log('[BackendFormsService] Total accessible projects:', response.data.length);
      if (response.data.length > 0) {
        console.log('[BackendFormsService] Accessible projects:', response.data.map(p => ({ id: p.id, name: p.name })));
      }

      return response.data;
    } catch (error) {
      console.error('[BackendFormsService] Error fetching accessible projects:', error);
      throw error;
    }
  }

  /**
   * Get all forms accessible to the current user
   * Forms are filtered by organization and user's project access
   * Returns forms grouped by project
   */
  async getAccessibleForms(): Promise<Record<string, { project: { id: string; name: string }; forms: FormWithSections[] }>> {
    try {
      console.log('[BackendFormsService] ========================================');
      console.log('[BackendFormsService] Starting getAccessibleForms...');
      
      // Get user's accessible projects
      const accessibleProjects = await this.getUserAccessibleProjects();
      const projectIds = accessibleProjects.map(p => p.id);
      console.log('[BackendFormsService] Project IDs to query:', projectIds);

      if (projectIds.length === 0) {
        console.warn('[BackendFormsService] No accessible projects found, returning empty result');
        return {};
      }

      // Fetch forms for each accessible project
      const formsByProject: Record<string, { project: { id: string; name: string }; forms: FormWithSections[] }> = {};

      for (const project of accessibleProjects) {
        try {
          console.log(`[BackendFormsService] Fetching forms for project: ${project.name} (${project.id})`);
          
          const response = await apiClient.get<FormWithSections[]>(`/forms/projects/${project.id}/forms`);
          
          if (response.success && response.data) {
            // Filter only published forms
            const publishedForms = response.data.filter(form => form.status === 'PUBLISHED');
            
            if (publishedForms.length > 0) {
              formsByProject[project.id] = {
                project: { id: project.id, name: project.name },
                forms: publishedForms,
              };
              
              console.log(`[BackendFormsService] Found ${publishedForms.length} published forms for project ${project.name}`);
            }
          }
        } catch (error) {
          console.error(`[BackendFormsService] Error fetching forms for project ${project.id}:`, error);
          // Continue with other projects
        }
      }

      console.log('[BackendFormsService] Final result - forms grouped by project:');
      Object.entries(formsByProject).forEach(([projectId, data]) => {
        console.log(`[BackendFormsService]   Project ${data.project.name} (${projectId}): ${data.forms.length} forms`);
        data.forms.forEach((form, index) => {
          console.log(`[BackendFormsService]     Form ${index + 1}: ${form.title} (${form.id})`);
        });
      });
      console.log('[BackendFormsService] ========================================');

      return formsByProject;
    } catch (error) {
      console.error('[BackendFormsService] Error fetching accessible forms:', error);
      console.error('[BackendFormsService] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    }
  }

  /**
   * Get a single form by ID
   */
  async getFormById(formId: string): Promise<FormWithSections | null> {
    try {
      console.log('[BackendFormsService] getFormById called with formId:', formId);
      
      // First try to get it as a public form (no auth required)
      try {
        const publicResponse = await apiClient.get<FormWithSections>(`/forms/public/${formId}`);
        if (publicResponse.success && publicResponse.data) {
          console.log('[BackendFormsService] Form found via public endpoint:', formId);
          return publicResponse.data;
        }
      } catch (error) {
        console.log('[BackendFormsService] Public form fetch failed, trying secure endpoint');
      }

      // If public fails, try secure endpoint (requires auth)
      const secureResponse = await apiClient.get<FormWithSections>(`/forms/secure/${formId}`);
      
      if (secureResponse.success && secureResponse.data) {
        console.log('[BackendFormsService] Form found via secure endpoint:', formId);
        return secureResponse.data;
      }

      console.warn('[BackendFormsService] Form not found with id:', formId);
      return null;
    } catch (error) {
      console.error('[BackendFormsService] Exception in getFormById:', error);
      console.error('[BackendFormsService] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      return null;
    }
  }

  /**
   * Get forms for a specific project
   */
  async getProjectForms(projectId: string): Promise<FormWithSections[]> {
    try {
      console.log('[BackendFormsService] getProjectForms called with projectId:', projectId);
      
      const response = await apiClient.get<FormWithSections[]>(`/forms/projects/${projectId}/forms`);
      
      if (!response.success || !response.data) {
        console.error('[BackendFormsService] Failed to fetch project forms:', response.error);
        return [];
      }

      // Filter only published forms
      const publishedForms = response.data.filter(form => form.status === 'PUBLISHED');
      console.log(`[BackendFormsService] Found ${publishedForms.length} published forms for project ${projectId}`);
      
      return publishedForms;
    } catch (error) {
      console.error('[BackendFormsService] Error fetching project forms:', error);
      return [];
    }
  }

  /**
   * Submit a form response
   */
  async submitFormResponse(formId: string, responseData: any): Promise<any> {
    try {
      console.log('[BackendFormsService] Submitting form response for formId:', formId);
      
      const response = await apiClient.post('/forms/responses', {
        formId,
        ...responseData,
      });
      
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to submit form response');
      }

      console.log('[BackendFormsService] Form response submitted successfully');
      return response.data;
    } catch (error) {
      console.error('[BackendFormsService] Error submitting form response:', error);
      throw error;
    }
  }
}

export const backendFormsService = new BackendFormsService();

