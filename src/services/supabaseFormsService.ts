import { supabase } from '@/lib/supabaseClient';
import type { Database } from '@/types/supabase';
import { Form, FormSection, FormQuestion } from '@/types/forms';
import { getCurrentUserOrganizationId } from './getCurrentUserOrganizationId';

type FormRow = Database['public']['Tables']['forms']['Row'];
type FormSectionRow = Database['public']['Tables']['form_sections']['Row'];
type FormQuestionRow = Database['public']['Tables']['form_questions']['Row'];

// Extended types with nested relations
type FormWithSections = Form & {
  sections?: (FormSection & {
    questions?: FormQuestion[];
  })[];
};

/**
 * Forms service for mobile app
 * Fetches forms accessible to the user based on organization and project permissions
 */
class SupabaseFormsService {
  /**
   * Get current user's organizationId
   */
  private async getCurrentUserOrganizationId(): Promise<string> {
    return getCurrentUserOrganizationId();
  }

  /**
   * Get all accessible projects for the current user
   * Returns projects where user has access (via project_access or roles)
   * Global-admin users automatically get access to all projects in their organization
   */
  async getUserAccessibleProjects(): Promise<Array<{ id: string; name: string }>> {
    try {
      console.log('[FormsService] Starting getUserAccessibleProjects...');
      const organizationId = await this.getCurrentUserOrganizationId();
      console.log('[FormsService] Organization ID:', organizationId);
      
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        console.error('[FormsService] No authenticated user found');
        throw new Error('Not authenticated');
      }
      console.log('[FormsService] Authenticated user ID:', authUser.id);

      // Get user profile
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', authUser.id)
        .eq('isActive', true)
        .single();

      if (userError) {
        console.error('[FormsService] Error fetching user profile:', userError);
      }

      if (!user) {
        console.error('[FormsService] User profile not found for auth_user_id:', authUser.id);
        throw new Error('User profile not found');
      }
      console.log('[FormsService] User profile ID:', user.id);

      // Check if user has global-admin role
      const { data: userRoles, error: userRolesError } = await supabase
        .from('user_roles')
        .select(`
          role:roles (
            name
          )
        `)
        .eq('userId', user.id)
        .eq('isActive', true);

      if (userRolesError) {
        console.error('[FormsService] Error fetching user_roles:', userRolesError);
      }

      const hasGlobalAdmin = userRoles?.some((ur: any) => ur.role?.name === 'global-admin');
      console.log('[FormsService] User has global-admin role:', hasGlobalAdmin);

      // If user has global-admin role, return all projects in their organization
      if (hasGlobalAdmin) {
        console.log('[FormsService] User is global-admin, returning all organization projects');
        const { data: allProjects, error: projectsError } = await supabase
          .from('projects')
          .select('id, name')
          .eq('organizationid', organizationId);

        if (projectsError) {
          console.error('[FormsService] Error fetching all organization projects:', projectsError);
          throw projectsError;
        }

        const projects = (allProjects || []).map((p: any) => ({
          id: p.id,
          name: p.name,
        }));

        console.log('[FormsService] Total accessible projects (global-admin):', projects.length);
        if (projects.length > 0) {
          console.log('[FormsService] Accessible projects:', projects.map(p => ({ id: p.id, name: p.name })));
        }

        return projects;
      }

      // For non-global-admin users, check user_project_access and project-scoped roles
      // Get projects via user_project_access
      const { data: projectAccess, error: projectAccessError } = await supabase
        .from('user_project_access')
        .select(`
          project:projects (
            id,
            name
          )
        `)
        .eq('userId', user.id)
        .eq('isActive', true);

      if (projectAccessError) {
        console.error('[FormsService] Error fetching user_project_access:', projectAccessError);
      } else {
        console.log('[FormsService] Found project access entries:', projectAccess?.length || 0);
        if (projectAccess && projectAccess.length > 0) {
          console.log('[FormsService] Project access details:', JSON.stringify(projectAccess, null, 2));
        }
      }

      // Get projects via user_roles with project associations
      const { data: projectScopedRoles, error: projectScopedRolesError } = await supabase
        .from('user_roles')
        .select(`
          project:projects (
            id,
            name
          )
        `)
        .eq('userId', user.id)
        .eq('isActive', true)
        .not('projectId', 'is', null);

      if (projectScopedRolesError) {
        console.error('[FormsService] Error fetching project-scoped user_roles:', projectScopedRolesError);
      } else {
        console.log('[FormsService] Found project-scoped role entries:', projectScopedRoles?.length || 0);
        if (projectScopedRoles && projectScopedRoles.length > 0) {
          console.log('[FormsService] Project-scoped roles details:', JSON.stringify(projectScopedRoles, null, 2));
        }
      }

      // Combine and deduplicate projects
      const projectsMap = new Map<string, { id: string; name: string }>();

      // Add from project access
      projectAccess?.forEach((access: any) => {
        if (access.project) {
          projectsMap.set(access.project.id, {
            id: access.project.id,
            name: access.project.name,
          });
        }
      });

      // Add from project-scoped roles
      projectScopedRoles?.forEach((role: any) => {
        if (role.project) {
          projectsMap.set(role.project.id, {
            id: role.project.id,
            name: role.project.name,
          });
        }
      });

      const accessibleProjects = Array.from(projectsMap.values());
      console.log('[FormsService] Total accessible projects:', accessibleProjects.length);
      if (accessibleProjects.length > 0) {
        console.log('[FormsService] Accessible projects:', accessibleProjects.map(p => ({ id: p.id, name: p.name })));
      } else {
        console.warn('[FormsService] No accessible projects found for user');
      }

      return accessibleProjects;
    } catch (error) {
      console.error('[FormsService] Error fetching accessible projects:', error);
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
      console.log('[FormsService] ========================================');
      console.log('[FormsService] Starting getAccessibleForms...');
      const organizationId = await this.getCurrentUserOrganizationId();
      console.log('[FormsService] Organization ID:', organizationId);
      
      // Get user's accessible projects
      const accessibleProjects = await this.getUserAccessibleProjects();
      const projectIds = accessibleProjects.map(p => p.id);
      console.log('[FormsService] Project IDs to query:', projectIds);

      if (projectIds.length === 0) {
        console.warn('[FormsService] No accessible projects found, returning empty result');
        return {};
      }

      // Fetch forms for accessible projects
      console.log('[FormsService] Querying forms with filters:');
      console.log('[FormsService]   - organizationid:', organizationId);
      console.log('[FormsService]   - projectId IN:', projectIds);
      console.log('[FormsService]   - status: PUBLISHED');
      
      const { data: forms, error } = await supabase
        .from('forms')
        .select(`
          *,
          sections:form_sections(
            *,
            questions:form_questions(*)
          )
        `)
        .eq('organizationid', organizationId)
        .in('projectId', projectIds)
        .eq('status', 'PUBLISHED') // Only published forms
        .order('createdAt', { ascending: false });

      if (error) {
        console.error('[FormsService] Supabase query error:', error);
        console.error('[FormsService] Error details:', JSON.stringify(error, null, 2));
        throw new Error(`Failed to fetch forms: ${error.message}`);
      }

      console.log('[FormsService] Raw query result - forms count:', forms?.length || 0);
      if (forms && forms.length > 0) {
        console.log('[FormsService] Forms found:');
        forms.forEach((form: any, index: number) => {
          console.log(`[FormsService]   Form ${index + 1}:`, {
            id: form.id,
            title: form.title,
            projectId: form.projectId,
            status: form.status,
            organizationid: form.organizationid,
            createdAt: form.createdAt,
            sectionsCount: form.sections?.length || 0,
          });
        });
      } else {
        console.warn('[FormsService] No forms returned from query');
        // Let's also check what forms exist in the database for debugging
        const { data: allFormsCheck, error: checkError } = await supabase
          .from('forms')
          .select('id, title, projectId, status, organizationid')
          .eq('organizationid', organizationId)
          .in('projectId', projectIds)
          .limit(100);
        
        if (!checkError && allFormsCheck) {
          console.log('[FormsService] All forms (including non-published) in accessible projects:', allFormsCheck.length);
          if (allFormsCheck.length > 0) {
            console.log('[FormsService] Forms by status:', {
              PUBLISHED: allFormsCheck.filter((f: any) => f.status === 'PUBLISHED').length,
              DRAFT: allFormsCheck.filter((f: any) => f.status === 'DRAFT').length,
              CLOSED: allFormsCheck.filter((f: any) => f.status === 'CLOSED').length,
              ARCHIVED: allFormsCheck.filter((f: any) => f.status === 'ARCHIVED').length,
            });
            console.log('[FormsService] All forms details:', JSON.stringify(allFormsCheck, null, 2));
          }
        }
      }

      // Group forms by project
      const formsByProject: Record<string, { project: { id: string; name: string }; forms: FormWithSections[] }> = {};

      (forms || []).forEach((form: any) => {
        const projectId = form.projectId;
        const project = accessibleProjects.find(p => p.id === projectId);

        if (!project) {
          console.warn(`[FormsService] Project not found for form ${form.id}, projectId: ${projectId}`);
          return; // Skip if project not found
        }

        if (!formsByProject[projectId]) {
          formsByProject[projectId] = {
            project: { id: project.id, name: project.name },
            forms: [],
          };
        }

        // Transform form data to match Form type
        const transformedForm: FormWithSections = {
          id: form.id,
          title: form.title,
          description: form.description || undefined,
          projectId: form.projectId,
          projectName: project.name,
          createdBy: form.createdBy,
          createdAt: form.createdAt,
          updatedAt: form.updatedAt,
          status: form.status as 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED',
          version: form.version || 1,
          sections: this.transformSections(form.sections || []),
          settings: form.settings || {
            requireAuthentication: false,
            allowAnonymous: false,
            notificationEmails: [],
          },
          responseCount: form.responseCount || 0,
          lastResponseAt: form.lastResponseAt || undefined,
          tags: form.tags || [],
          category: form.category || undefined,
        };

        formsByProject[projectId].forms.push(transformedForm);
      });

      console.log('[FormsService] Final result - forms grouped by project:');
      Object.entries(formsByProject).forEach(([projectId, data]) => {
        console.log(`[FormsService]   Project ${data.project.name} (${projectId}): ${data.forms.length} forms`);
        data.forms.forEach((form, index) => {
          console.log(`[FormsService]     Form ${index + 1}: ${form.title} (${form.id})`);
        });
      });
      console.log('[FormsService] ========================================');

      return formsByProject;
    } catch (error) {
      console.error('[FormsService] Error fetching accessible forms:', error);
      console.error('[FormsService] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    }
  }

  /**
   * Get a single form by ID
   */
  async getFormById(formId: string): Promise<FormWithSections | null> {
    try {
      console.log('[FormsService] getFormById called with formId:', formId);
      const organizationId = await this.getCurrentUserOrganizationId();
      console.log('[FormsService] Organization ID:', organizationId);
      
      // Get user's accessible projects
      const accessibleProjects = await this.getUserAccessibleProjects();
      const projectIds = accessibleProjects.map(p => p.id);
      console.log('[FormsService] Accessible project IDs:', projectIds);

      if (projectIds.length === 0) {
        console.warn('[FormsService] No accessible projects, returning null');
        return null;
      }

      console.log('[FormsService] Querying form with filters:');
      console.log('[FormsService]   - id:', formId);
      console.log('[FormsService]   - organizationid:', organizationId);
      console.log('[FormsService]   - projectId IN:', projectIds);

      const { data: form, error } = await supabase
        .from('forms')
        .select(`
          *,
          sections:form_sections(
            *,
            questions:form_questions(*)
          )
        `)
        .eq('id', formId)
        .eq('organizationid', organizationId)
        .in('projectId', projectIds)
        .single();

      if (error) {
        console.error('[FormsService] Error fetching form by ID:', error);
        console.error('[FormsService] Error details:', JSON.stringify(error, null, 2));
        return null;
      }

      if (!form) {
        console.warn('[FormsService] Form not found with id:', formId);
        return null;
      }

      console.log('[FormsService] Form found:', {
        id: form.id,
        title: form.title,
        projectId: form.projectId,
        status: form.status,
        organizationid: form.organizationid,
      });

      const project = accessibleProjects.find(p => p.id === form.projectId);
      if (!project) {
        console.warn('[FormsService] Project not found for form, projectId:', form.projectId);
        return null;
      }

      // Transform form data
      const transformedForm: FormWithSections = {
        id: form.id,
        title: form.title,
        description: form.description || undefined,
        projectId: form.projectId,
        projectName: project.name,
        createdBy: form.createdBy,
        createdAt: form.createdAt,
        updatedAt: form.updatedAt,
        status: form.status as 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED',
        version: form.version || 1,
        sections: this.transformSections(form.sections || []),
        settings: (form.settings && typeof form.settings === 'object' && !Array.isArray(form.settings)) 
          ? (form.settings as any)
          : {
              requireAuthentication: false,
              allowAnonymous: false,
              notificationEmails: [],
            },
        responseCount: form.responseCount || 0,
        lastResponseAt: form.lastResponseAt || undefined,
        tags: form.tags || [],
        category: form.category || undefined,
      };

      console.log('[FormsService] Returning transformed form:', transformedForm.id);
      return transformedForm;
    } catch (error) {
      console.error('[FormsService] Exception in getFormById:', error);
      console.error('[FormsService] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      return null;
    }
  }

  /**
   * Transform database sections to FormSection type
   */
  private transformSections(sections: any[]): FormSection[] {
    return sections
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((section: any) => ({
        id: section.id,
        title: section.title,
        description: section.description || undefined,
        order: section.order || 0,
        questions: this.transformQuestions(section.questions || []),
        config: section.config || {},
        conditional: section.conditional || {},
      }));
  }

  /**
   * Transform database questions to FormQuestion type
   */
  private transformQuestions(questions: any[]): FormQuestion[] {
    return questions
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((question: any) => {
        const baseQuestion: any = {
          id: question.id,
          type: question.type,
          title: question.title,
          description: question.description || undefined,
          isRequired: question.isRequired || false,
          validationRules: question.validationRules || [],
          order: question.order || 0,
          conditional: question.conditional || {},
        };

        // Add type-specific fields from config
        if (question.config) {
          // Parse config if it's a string
          const config = typeof question.config === 'string' ? JSON.parse(question.config) : question.config;
          
          // Single/Multiple choice options
          if (config.options) {
            baseQuestion.options = config.options;
          }
          
          // Preserve the original config
          baseQuestion.config = config;
          
          // Number question fields
          if (config.min !== undefined) baseQuestion.min = config.min;
          if (config.max !== undefined) baseQuestion.max = config.max;
          if (config.step !== undefined) baseQuestion.step = config.step;
          
          // Text question fields
          if (config.maxLength !== undefined) baseQuestion.maxLength = config.maxLength;
          if (config.placeholder) baseQuestion.placeholder = config.placeholder;
          
          // Date question fields
          if (config.minDate) baseQuestion.minDate = config.minDate;
          if (config.maxDate) baseQuestion.maxDate = config.maxDate;
          
          // Location question fields
          if (config.accuracy !== undefined) baseQuestion.accuracy = config.accuracy;
          if (config.captureMode) baseQuestion.captureMode = config.captureMode;
          
          // Media question fields
          if (config.maxFiles !== undefined) baseQuestion.maxFiles = config.maxFiles;
          if (config.maxFileSize !== undefined) baseQuestion.maxFileSize = config.maxFileSize;
          if (config.allowedFormats) baseQuestion.allowedFormats = config.allowedFormats;
          
          // Likert scale fields
          if (config.scaleLabels) baseQuestion.scaleLabels = config.scaleLabels;
          
          // Slider fields
          if (config.unit) baseQuestion.unit = config.unit;
          
          // Additional config properties
          if (config.allowOther !== undefined) baseQuestion.allowOther = config.allowOther;
          if (config.maxSelections !== undefined) baseQuestion.maxSelections = config.maxSelections;
          if (config.displayType) baseQuestion.displayType = config.displayType;
          if (config.statements) baseQuestion.statements = config.statements;
          if (config.defaultScaleType) baseQuestion.defaultScaleType = config.defaultScaleType;
          if (config.defaultLabels) baseQuestion.defaultLabels = config.defaultLabels;
        } else {
          // No config - ensure options is at least an empty array for choice questions
          if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') {
            baseQuestion.options = [];
          }
        }

        return baseQuestion as FormQuestion;
      });
  }
}

export const supabaseFormsService = new SupabaseFormsService();

