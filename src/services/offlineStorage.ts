import * as SQLite from 'expo-sqlite';
import { Form, LocalFormResponse, DownloadedForm, LocalMediaAttachment, FormResponseStatus } from '@/types/forms';

const DB_NAME = 'ics_idms.db';
let db: SQLite.SQLiteDatabase | null = null;

// Initialize database
export async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    return db;
  }

  db = await SQLite.openDatabaseAsync(DB_NAME);
  
  // Create tables
  await db.execAsync(`
    -- User profile table (stores user id and organizationid for sync operations)
    CREATE TABLE IF NOT EXISTS user_profile (
      auth_user_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      organizationid TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Downloaded forms table
    CREATE TABLE IF NOT EXISTS downloaded_forms (
      id TEXT PRIMARY KEY,
      form_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      project_id TEXT NOT NULL,
      project_name TEXT,
      version INTEGER NOT NULL,
      downloaded_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      form_data TEXT NOT NULL
    );

    -- Form responses table
    CREATE TABLE IF NOT EXISTS form_responses (
      id TEXT PRIMARY KEY,
      form_id TEXT NOT NULL,
      form_title TEXT,
      data TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      is_complete INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      synced_at INTEGER,
      sync_status TEXT DEFAULT 'pending',
      error_message TEXT,
      conditional_data TEXT,
      current_section_index INTEGER DEFAULT 0,
      section_instance_counts TEXT,
      FOREIGN KEY (form_id) REFERENCES downloaded_forms(form_id)
    );

    -- Media attachments table
    CREATE TABLE IF NOT EXISTS media_attachments (
      id TEXT PRIMARY KEY,
      response_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      uploaded INTEGER NOT NULL DEFAULT 0,
      upload_url TEXT,
      sync_status TEXT DEFAULT 'pending',
      FOREIGN KEY (response_id) REFERENCES form_responses(id) ON DELETE CASCADE
    );

    -- Create indexes for better query performance
    CREATE INDEX IF NOT EXISTS idx_form_responses_form_id ON form_responses(form_id);
    CREATE INDEX IF NOT EXISTS idx_form_responses_status ON form_responses(status);
    CREATE INDEX IF NOT EXISTS idx_form_responses_sync_status ON form_responses(sync_status);
    CREATE INDEX IF NOT EXISTS idx_media_attachments_response_id ON media_attachments(response_id);
    CREATE INDEX IF NOT EXISTS idx_downloaded_forms_project_id ON downloaded_forms(project_id);
  `);

  // Add new columns if they don't exist (migration for existing databases)
  try {
    await db.execAsync(`
      -- Add conditional_data column if it doesn't exist
      ALTER TABLE form_responses ADD COLUMN conditional_data TEXT;
    `);
  } catch (error: any) {
    // Column might already exist, ignore error
    if (!error?.message?.includes('duplicate column')) {
      console.warn('Migration: conditional_data column may already exist:', error);
    }
  }

  try {
    await db.execAsync(`
      -- Add current_section_index column if it doesn't exist
      ALTER TABLE form_responses ADD COLUMN current_section_index INTEGER DEFAULT 0;
    `);
  } catch (error: any) {
    // Column might already exist, ignore error
    if (!error?.message?.includes('duplicate column')) {
      console.warn('Migration: current_section_index column may already exist:', error);
    }
  }

  try {
    await db.execAsync(`
      -- Add section_instance_counts column if it doesn't exist
      ALTER TABLE form_responses ADD COLUMN section_instance_counts TEXT;
    `);
  } catch (error: any) {
    // Column might already exist, ignore error
    if (!error?.message?.includes('duplicate column')) {
      console.warn('Migration: section_instance_counts column may already exist:', error);
    }
  }

  return db;
}

// User Profile Operations
export interface LocalUserProfile {
  authUserId: string;
  userId: string;
  organizationId: string;
  updatedAt: number;
}

export async function saveUserProfile(authUserId: string, userId: string, organizationId: string): Promise<void> {
  const database = await initializeDatabase();
  
  await database.runAsync(
    `INSERT OR REPLACE INTO user_profile 
     (auth_user_id, user_id, organizationid, updated_at)
     VALUES (?, ?, ?, ?)`,
    [authUserId, userId, organizationId, Date.now()]
  );
}

export async function getUserProfile(authUserId: string): Promise<LocalUserProfile | null> {
  const database = await initializeDatabase();
  
  const result = await database.getFirstAsync<{
    auth_user_id: string;
    user_id: string;
    organizationid: string;
    updated_at: number;
  }>('SELECT * FROM user_profile WHERE auth_user_id = ?', [authUserId]);

  if (!result) {
    return null;
  }

  return {
    authUserId: result.auth_user_id,
    userId: result.user_id,
    organizationId: result.organizationid,
    updatedAt: result.updated_at,
  };
}

export async function getCurrentUserProfile(): Promise<LocalUserProfile | null> {
  const database = await initializeDatabase();
  
  // Get the most recently updated profile (should only be one, but just in case)
  const result = await database.getFirstAsync<{
    auth_user_id: string;
    user_id: string;
    organizationid: string;
    updated_at: number;
  }>('SELECT * FROM user_profile ORDER BY updated_at DESC LIMIT 1');

  if (!result) {
    return null;
  }

  return {
    authUserId: result.auth_user_id,
    userId: result.user_id,
    organizationId: result.organizationid,
    updatedAt: result.updated_at,
  };
}

export async function clearUserProfile(): Promise<void> {
  const database = await initializeDatabase();
  await database.runAsync('DELETE FROM user_profile');
}

// Downloaded Forms Operations
export async function saveDownloadedForm(form: Form, projectName?: string): Promise<void> {
  const database = await initializeDatabase();
  
  await database.runAsync(
    `INSERT OR REPLACE INTO downloaded_forms 
     (id, form_id, title, description, project_id, project_name, version, downloaded_at, updated_at, form_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `form_${form.id}`,
      form.id,
      form.title,
      form.description || null,
      form.projectId,
      projectName || null,
      form.version,
      Date.now(),
      Date.now(),
      JSON.stringify(form),
    ]
  );
}

export async function updateDownloadedForm(form: Form & { projectName?: string }): Promise<void> {
  const database = await initializeDatabase();
  
  await database.runAsync(
    `UPDATE downloaded_forms 
     SET title = ?, description = ?, version = ?, updated_at = ?, form_data = ?
     WHERE form_id = ?`,
    [
      form.title,
      form.description || null,
      form.version,
      Date.now(),
      JSON.stringify(form),
      form.id,
    ]
  );
}

export async function getDownloadedForms(): Promise<DownloadedForm[]> {
  const database = await initializeDatabase();
  
  const result = await database.getAllAsync<{
    id: string;
    form_id: string;
    title: string;
    description: string | null;
    project_id: string;
    project_name: string | null;
    version: number;
    downloaded_at: number;
    updated_at: number;
    form_data: string;
  }>('SELECT * FROM downloaded_forms ORDER BY updated_at DESC');

  return result.map((row) => ({
    id: row.id,
    formId: row.form_id,
    title: row.title,
    description: row.description || undefined,
    projectId: row.project_id,
    projectName: row.project_name || undefined,
    version: row.version,
    downloadedAt: row.downloaded_at,
    updatedAt: row.updated_at,
    formData: JSON.parse(row.form_data) as Form,
  }));
}

export async function getDownloadedFormsByProject(projectId: string): Promise<DownloadedForm[]> {
  const database = await initializeDatabase();
  
  const result = await database.getAllAsync<{
    id: string;
    form_id: string;
    title: string;
    description: string | null;
    project_id: string;
    project_name: string | null;
    version: number;
    downloaded_at: number;
    updated_at: number;
    form_data: string;
  }>('SELECT * FROM downloaded_forms WHERE project_id = ? ORDER BY updated_at DESC', [projectId]);

  return result.map((row) => ({
    id: row.id,
    formId: row.form_id,
    title: row.title,
    description: row.description || undefined,
    projectId: row.project_id,
    projectName: row.project_name || undefined,
    version: row.version,
    downloadedAt: row.downloaded_at,
    updatedAt: row.updated_at,
    formData: JSON.parse(row.form_data) as Form,
  }));
}

export async function getDownloadedForm(formId: string): Promise<DownloadedForm | null> {
  const database = await initializeDatabase();
  
  const result = await database.getFirstAsync<{
    id: string;
    form_id: string;
    title: string;
    description: string | null;
    project_id: string;
    project_name: string | null;
    version: number;
    downloaded_at: number;
    updated_at: number;
    form_data: string;
  }>('SELECT * FROM downloaded_forms WHERE form_id = ?', [formId]);

  if (!result) {
    return null;
  }

  return {
    id: result.id,
    formId: result.form_id,
    title: result.title,
    description: result.description || undefined,
    projectId: result.project_id,
    projectName: result.project_name || undefined,
    version: result.version,
    downloadedAt: result.downloaded_at,
    updatedAt: result.updated_at,
    formData: JSON.parse(result.form_data) as Form,
  };
}

export async function deleteDownloadedForm(formId: string): Promise<void> {
  const database = await initializeDatabase();
  
  await database.runAsync('DELETE FROM downloaded_forms WHERE form_id = ?', [formId]);
}

// Form Responses Operations
export async function saveFormResponse(response: LocalFormResponse): Promise<void> {
  console.log('💾 [offlineStorage.saveFormResponse] Saving response to SQLite:', {
    id: response.id,
    formId: response.formId,
    formTitle: response.formTitle,
    dataKeys: Object.keys(response.data),
    dataCount: Object.keys(response.data).length,
    status: response.status,
    isComplete: response.isComplete,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
    syncStatus: response.syncStatus
  });

  const database = await initializeDatabase();
  
  const dataJson = JSON.stringify(response.data);
  console.log('📋 [offlineStorage.saveFormResponse] Data JSON preview:', {
    jsonLength: dataJson.length,
    jsonPreview: dataJson.substring(0, 200),
    isValidJson: (() => {
      try {
        JSON.parse(dataJson);
        return true;
      } catch {
        return false;
      }
    })()
  });

  try {
    // Extract metadata from response (conditionalData, currentSectionIndex, sectionInstanceCounts)
    const conditionalData = (response as any).conditionalData || {};
    const currentSectionIndex = (response as any).currentSectionIndex ?? 0;
    const sectionInstanceCounts = (response as any).sectionInstanceCounts || {};

    await database.runAsync(
      `INSERT OR REPLACE INTO form_responses 
       (id, form_id, form_title, data, status, is_complete, created_at, updated_at, synced_at, sync_status, error_message, conditional_data, current_section_index, section_instance_counts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        response.id,
        response.formId,
        response.formTitle || null,
        dataJson,
        response.status,
        response.isComplete ? 1 : 0,
        response.createdAt,
        response.updatedAt,
        response.syncedAt || null,
        response.syncStatus || 'pending',
        response.errorMessage || null,
        JSON.stringify(conditionalData),
        currentSectionIndex,
        JSON.stringify(sectionInstanceCounts),
      ]
    );
    console.log('✅ [offlineStorage.saveFormResponse] Response saved successfully to SQLite');
  } catch (error) {
    console.error('❌ [offlineStorage.saveFormResponse] Failed to save response:', error);
    console.error('[offlineStorage.saveFormResponse] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      responseId: response.id,
      formId: response.formId,
      dataSize: dataJson.length
    });
    throw error;
  }
}

export async function getFormResponses(status?: FormResponseStatus): Promise<LocalFormResponse[]> {
  console.log('📋 [offlineStorage.getFormResponses] Loading responses from SQLite:', { status });
  
  const database = await initializeDatabase();
  
  let query = 'SELECT * FROM form_responses';
  const params: any[] = [];
  
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY updated_at DESC';
  
  console.log('🔍 [offlineStorage.getFormResponses] Executing query:', { query, params });

  try {
    const result = await database.getAllAsync<{
      id: string;
      form_id: string;
      form_title: string | null;
      data: string;
      status: string;
      is_complete: number;
      created_at: number;
      updated_at: number;
      synced_at: number | null;
      sync_status: string | null;
      error_message: string | null;
      conditional_data: string | null;
      current_section_index: number | null;
      section_instance_counts: string | null;
    }>(query, params);

    console.log('📊 [offlineStorage.getFormResponses] Raw SQLite results:', {
      totalRows: result.length,
      firstRowSample: result.length > 0 ? {
        id: result[0].id,
        form_id: result[0].form_id,
        form_title: result[0].form_title,
        status: result[0].status,
        dataPreview: result[0].data.substring(0, 100),
        dataLength: result[0].data.length,
        created_at: result[0].created_at,
        updated_at: result[0].updated_at
      } : null
    });

    const mappedResults = result.map((row) => {
      try {
        const parsedData = JSON.parse(row.data);
        const conditionalData = row.conditional_data ? JSON.parse(row.conditional_data) : {};
        const currentSectionIndex = row.current_section_index ?? 0;
        const sectionInstanceCounts = row.section_instance_counts ? JSON.parse(row.section_instance_counts) : {};
        
        const response: any = {
          id: row.id,
          formId: row.form_id,
          formTitle: row.form_title || undefined,
          data: parsedData,
          status: row.status as FormResponseStatus,
          isComplete: row.is_complete === 1,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          syncedAt: row.synced_at || undefined,
          syncStatus: (row.sync_status || 'pending') as 'pending' | 'syncing' | 'synced' | 'failed',
          errorMessage: row.error_message || undefined,
        };
        
        // Add metadata fields if they exist
        if (Object.keys(conditionalData).length > 0) {
          response.conditionalData = conditionalData;
        }
        if (currentSectionIndex > 0) {
          response.currentSectionIndex = currentSectionIndex;
        }
        if (Object.keys(sectionInstanceCounts).length > 0) {
          response.sectionInstanceCounts = sectionInstanceCounts;
        }

        console.log('🔄 [offlineStorage.getFormResponses] Mapped response:', {
          id: response.id,
          formTitle: response.formTitle,
          dataKeys: Object.keys(response.data),
          status: response.status
        });

        return response;
      } catch (parseError) {
        console.error('❌ [offlineStorage.getFormResponses] Failed to parse data for row:', {
          id: row.id,
          dataPreview: row.data.substring(0, 200),
          error: parseError
        });
        throw parseError;
      }
    });

    console.log('✅ [offlineStorage.getFormResponses] Successfully loaded responses:', {
      totalCount: mappedResults.length,
      status,
      responseIds: mappedResults.map(r => r.id)
    });

    return mappedResults;
  } catch (error) {
    console.error('❌ [offlineStorage.getFormResponses] Failed to load responses:', error);
    console.error('[offlineStorage.getFormResponses] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      status,
      query,
      params
    });
    throw error;
  }
}

export async function getFormResponse(responseId: string): Promise<LocalFormResponse | null> {
  console.log('🔍 [offlineStorage.getFormResponse] Loading response from SQLite:', { responseId });
  
  const database = await initializeDatabase();
  
  try {
    const result = await database.getFirstAsync<{
      id: string;
      form_id: string;
      form_title: string | null;
      data: string;
      status: string;
      is_complete: number;
      created_at: number;
      updated_at: number;
      synced_at: number | null;
      sync_status: string | null;
      error_message: string | null;
      conditional_data: string | null;
      current_section_index: number | null;
      section_instance_counts: string | null;
    }>('SELECT * FROM form_responses WHERE id = ?', [responseId]);

    if (!result) {
      console.log('❌ [offlineStorage.getFormResponse] Response not found:', { responseId });
      return null;
    }

    console.log('📊 [offlineStorage.getFormResponse] Raw SQLite result:', {
      id: result.id,
      form_id: result.form_id,
      form_title: result.form_title,
      status: result.status,
      dataPreview: result.data.substring(0, 100),
      dataLength: result.data.length,
      created_at: result.created_at,
      updated_at: result.updated_at
    });

    const parsedData = JSON.parse(result.data);
    const conditionalData = result.conditional_data ? JSON.parse(result.conditional_data) : {};
    const currentSectionIndex = result.current_section_index ?? 0;
    const sectionInstanceCounts = result.section_instance_counts ? JSON.parse(result.section_instance_counts) : {};
    
    const response: any = {
      id: result.id,
      formId: result.form_id,
      formTitle: result.form_title || undefined,
      data: parsedData,
      status: result.status as FormResponseStatus,
      isComplete: result.is_complete === 1,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      syncedAt: result.synced_at || undefined,
      syncStatus: (result.sync_status || 'pending') as 'pending' | 'syncing' | 'synced' | 'failed',
      errorMessage: result.error_message || undefined,
    };
    
    // Add metadata fields if they exist
    if (Object.keys(conditionalData).length > 0) {
      response.conditionalData = conditionalData;
    }
    if (currentSectionIndex > 0) {
      response.currentSectionIndex = currentSectionIndex;
    }
    if (Object.keys(sectionInstanceCounts).length > 0) {
      response.sectionInstanceCounts = sectionInstanceCounts;
    }

    console.log('✅ [offlineStorage.getFormResponse] Successfully loaded response:', {
      id: response.id,
      formTitle: response.formTitle,
      dataKeys: Object.keys(response.data),
      status: response.status
    });

    return response;
  } catch (error) {
    console.error('❌ [offlineStorage.getFormResponse] Failed to load response:', error);
    console.error('[offlineStorage.getFormResponse] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      responseId
    });
    throw error;
  }
}

export async function updateFormResponse(response: Partial<LocalFormResponse> & { id: string }): Promise<void> {
  const database = await initializeDatabase();
  
  const updates: string[] = [];
  const values: any[] = [];
  
  if (response.data !== undefined) {
    updates.push('data = ?');
    values.push(JSON.stringify(response.data));
  }
  if (response.status !== undefined) {
    updates.push('status = ?');
    values.push(response.status);
  }
  if (response.isComplete !== undefined) {
    updates.push('is_complete = ?');
    values.push(response.isComplete ? 1 : 0);
  }
  if (response.updatedAt !== undefined) {
    updates.push('updated_at = ?');
    values.push(response.updatedAt);
  }
  if (response.syncedAt !== undefined) {
    updates.push('synced_at = ?');
    values.push(response.syncedAt);
  }
  if (response.syncStatus !== undefined) {
    updates.push('sync_status = ?');
    values.push(response.syncStatus);
  }
  if (response.errorMessage !== undefined) {
    updates.push('error_message = ?');
    values.push(response.errorMessage || null);
  }
  if ((response as any).conditionalData !== undefined) {
    updates.push('conditional_data = ?');
    values.push(JSON.stringify((response as any).conditionalData));
  }
  if ((response as any).currentSectionIndex !== undefined) {
    updates.push('current_section_index = ?');
    values.push((response as any).currentSectionIndex);
  }
  if ((response as any).sectionInstanceCounts !== undefined) {
    updates.push('section_instance_counts = ?');
    values.push(JSON.stringify((response as any).sectionInstanceCounts));
  }
  
  // Always update updated_at to current time if not explicitly set
  if (response.updatedAt === undefined) {
    updates.push('updated_at = ?');
    values.push(Date.now());
  }
  
  values.push(response.id);
  
  await database.runAsync(
    `UPDATE form_responses SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteFormResponse(responseId: string): Promise<void> {
  const database = await initializeDatabase();
  
  // Delete media attachments first (CASCADE should handle this, but being explicit)
  await database.runAsync('DELETE FROM media_attachments WHERE response_id = ?', [responseId]);
  
  // Delete response
  await database.runAsync('DELETE FROM form_responses WHERE id = ?', [responseId]);
}

export async function getResponseCounts(): Promise<{
  drafts: number;
  readyToSend: number;
  sent: number;
}> {
  const database = await initializeDatabase();
  
  const drafts = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM form_responses WHERE status = ?',
    ['draft']
  );
  
  const readyToSend = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM form_responses WHERE status = ?',
    ['ready_to_send']
  );
  
  const sent = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM form_responses WHERE status = ?',
    ['sent']
  );
  
  return {
    drafts: drafts?.count || 0,
    readyToSend: readyToSend?.count || 0,
    sent: sent?.count || 0,
  };
}

// Media Attachments Operations
export async function saveMediaAttachment(attachment: LocalMediaAttachment): Promise<void> {
  const database = await initializeDatabase();
  
  await database.runAsync(
    `INSERT OR REPLACE INTO media_attachments 
     (id, response_id, question_id, file_path, file_name, file_type, file_size, uploaded, upload_url, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      attachment.id,
      attachment.responseId,
      attachment.questionId,
      attachment.filePath,
      attachment.fileName,
      attachment.fileType,
      attachment.fileSize,
      attachment.uploaded ? 1 : 0,
      attachment.uploadUrl || null,
      attachment.syncStatus || 'pending',
    ]
  );
}

export async function getMediaAttachmentsByResponse(responseId: string): Promise<LocalMediaAttachment[]> {
  const database = await initializeDatabase();
  
  const result = await database.getAllAsync<{
    id: string;
    response_id: string;
    question_id: string;
    file_path: string;
    file_name: string;
    file_type: string;
    file_size: number;
    uploaded: number;
    upload_url: string | null;
    sync_status: string | null;
  }>('SELECT * FROM media_attachments WHERE response_id = ?', [responseId]);

  return result.map((row) => ({
    id: row.id,
    responseId: row.response_id,
    questionId: row.question_id,
    filePath: row.file_path,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    uploaded: row.uploaded === 1,
    uploadUrl: row.upload_url || undefined,
    syncStatus: (row.sync_status || 'pending') as 'pending' | 'uploading' | 'uploaded' | 'failed',
  }));
}

export async function getMediaAttachmentsByQuestion(responseId: string, questionId: string): Promise<LocalMediaAttachment[]> {
  const database = await initializeDatabase();
  
  const result = await database.getAllAsync<{
    id: string;
    response_id: string;
    question_id: string;
    file_path: string;
    file_name: string;
    file_type: string;
    file_size: number;
    uploaded: number;
    upload_url: string | null;
    sync_status: string | null;
  }>('SELECT * FROM media_attachments WHERE response_id = ? AND question_id = ?', [responseId, questionId]);

  return result.map((row) => ({
    id: row.id,
    responseId: row.response_id,
    questionId: row.question_id,
    filePath: row.file_path,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    uploaded: row.uploaded === 1,
    uploadUrl: row.upload_url || undefined,
    syncStatus: (row.sync_status || 'pending') as 'pending' | 'uploading' | 'uploaded' | 'failed',
  }));
}

export async function deleteMediaAttachment(attachmentId: string): Promise<void> {
  const database = await initializeDatabase();
  
  await database.runAsync('DELETE FROM media_attachments WHERE id = ?', [attachmentId]);
}

export async function deleteMediaAttachmentsByResponse(responseId: string): Promise<void> {
  const database = await initializeDatabase();
  
  await database.runAsync('DELETE FROM media_attachments WHERE response_id = ?', [responseId]);
}
