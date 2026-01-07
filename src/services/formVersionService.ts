import { apiClient } from '@/lib/api/client';
import { Form } from '@/types/forms';
import { getDownloadedForm, updateDownloadedForm } from './offlineStorage';

/**
 * Service for checking form versions and handling updates
 */

export interface FormVersionCheckResult {
  needsUpdate: boolean;
  currentVersion: number;
  serverVersion: number;
  form?: Form;
  message?: string;
}

/**
 * Check if a downloaded form needs to be updated
 */
export async function checkFormVersion(formId: string): Promise<FormVersionCheckResult> {
  try {
    // Get local form version
    const localForm = await getDownloadedForm(formId);
    if (!localForm) {
      return {
        needsUpdate: false,
        currentVersion: 0,
        serverVersion: 0,
        message: 'Form not found locally',
      };
    }

    // Fetch latest version from server (try public endpoint first)
    let serverForm: any = null;
    
    try {
      const publicResponse = await apiClient.get<Form>(`/forms/public/${formId}`);
      if (publicResponse.success && publicResponse.data) {
        serverForm = publicResponse.data;
      }
    } catch (error) {
      // Try secure endpoint if public fails
      try {
        const secureResponse = await apiClient.get<Form>(`/forms/secure/${formId}`);
        if (secureResponse.success && secureResponse.data) {
          serverForm = secureResponse.data;
        }
      } catch (secureError) {
        console.error('Error checking form version:', secureError);
        return {
          needsUpdate: false,
          currentVersion: localForm.version,
          serverVersion: localForm.version,
          message: 'Unable to check version',
        };
      }
    }

    if (!serverForm) {
      return {
        needsUpdate: false,
        currentVersion: localForm.version,
        serverVersion: localForm.version,
        message: 'Form not found on server',
      };
    }

    const needsUpdate = serverForm.version > localForm.version;

    return {
      needsUpdate,
      currentVersion: localForm.version,
      serverVersion: serverForm.version,
      form: serverForm as any,
      message: needsUpdate
        ? `Form has been updated (v${localForm.version} → v${serverForm.version})`
        : 'Form is up to date',
    };
  } catch (error) {
    console.error('Error in checkFormVersion:', error);
    return {
      needsUpdate: false,
      currentVersion: 0,
      serverVersion: 0,
      message: 'Error checking version',
    };
  }
}

/**
 * Update a downloaded form to the latest version
 */
export async function updateDownloadedFormVersion(formId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { backendFormsService } = await import('./backendFormsService');
    
    // Fetch latest form from server
    const serverForm = await backendFormsService.getFormById(formId);
    if (!serverForm) {
      return {
        success: false,
        error: 'Form not found on server',
      };
    }

    // Get project name if available
    const localForm = await getDownloadedForm(formId);
    const projectName = localForm?.projectName;

    // Transform serverForm to match Form type
    const formToUpdate: Form & { projectName?: string } = {
      ...serverForm,
      projectName,
    };

    // Update local form
    await updateDownloadedForm(formToUpdate);

    return {
      success: true,
    };
  } catch (error: any) {
    console.error('Error updating form version:', error);
    return {
      success: false,
      error: error.message || 'Failed to update form',
    };
  }
}

/**
 * Check all downloaded forms for updates
 */
export async function checkAllFormVersions(): Promise<
  Array<{ formId: string; needsUpdate: boolean; currentVersion: number; serverVersion: number }>
> {
  const { getDownloadedForms } = await import('./offlineStorage');
  const downloadedForms = await getDownloadedForms();

  const checks = await Promise.all(
    downloadedForms.map(async (form) => {
      const result = await checkFormVersion(form.formId);
      return {
        formId: form.formId,
        needsUpdate: result.needsUpdate,
        currentVersion: result.currentVersion,
        serverVersion: result.serverVersion,
      };
    })
  );

  return checks;
}

