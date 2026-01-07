// Shared form types - adapted from web app for React Native
// These types should match the web app's form types

export type QuestionType = 
  | 'SHORT_TEXT'
  | 'LONG_TEXT'
  | 'NUMBER'
  | 'EMAIL'
  | 'PHONE'
  | 'DATE'
  | 'DATETIME'
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'LIKERT_SCALE'
  | 'YES_NO'
  | 'SLIDER'
  | 'LOCATION'
  | 'IMAGE_UPLOAD'
  | 'VIDEO_UPLOAD'
  | 'AUDIO_UPLOAD'
  | 'FILE_UPLOAD';

export interface ValidationRule {
  type: 'REQUIRED' | 'MIN_LENGTH' | 'MAX_LENGTH' | 'MIN' | 'MAX' | 'PATTERN' | 'CUSTOM';
  value?: string | number;
  message: string;
}

export interface BaseQuestion {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  isRequired: boolean;
  validationRules: ValidationRule[];
  order: number;
  conditional?: {
    dependsOn: string;
    showWhen: string | number | boolean;
    operator: 'EQUALS' | 'NOT_EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'CONTAINS';
  };
}

export interface ShortTextQuestion extends BaseQuestion {
  type: 'SHORT_TEXT';
  maxLength?: number;
  placeholder?: string;
}

export interface LongTextQuestion extends BaseQuestion {
  type: 'LONG_TEXT';
  maxLength?: number;
  placeholder?: string;
  rows?: number;
}

export interface NumberQuestion extends BaseQuestion {
  type: 'NUMBER';
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

export interface EmailQuestion extends BaseQuestion {
  type: 'EMAIL';
  placeholder?: string;
}

export interface PhoneQuestion extends BaseQuestion {
  type: 'PHONE';
  placeholder?: string;
}

export interface SingleChoiceQuestion extends BaseQuestion {
  type: 'SINGLE_CHOICE';
  options: Array<{
    id: string;
    label: string;
    value: string;
    conditionalQuestions?: FormQuestion[];
  }>;
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'MULTIPLE_CHOICE';
  options: Array<{
    id: string;
    label: string;
    value: string;
    conditionalQuestions?: FormQuestion[];
  }>;
  minSelections?: number;
  maxSelections?: number;
}

export interface DateQuestion extends BaseQuestion {
  type: 'DATE';
  minDate?: string;
  maxDate?: string;
}

export interface LocationQuestion extends BaseQuestion {
  type: 'LOCATION';
  accuracy?: 'low' | 'medium' | 'high'; // Accuracy level for GPS
  includeAddress?: boolean; // Whether to capture address from coordinates
  allowManualInput?: boolean; // Allow manual coordinate entry
}

export interface MediaUploadQuestion extends BaseQuestion {
  type: 'IMAGE_UPLOAD' | 'VIDEO_UPLOAD' | 'AUDIO_UPLOAD' | 'FILE_UPLOAD';
  maxFiles?: number;
  maxFileSize?: number; // in bytes
  allowedFormats?: string[];
  acceptedFileTypes?: string[]; // For document picker
  allowEditing?: boolean; // For image/video picker
  imageQuality?: number; // For image picker (0-1)
}

export interface LikertScaleQuestion extends BaseQuestion {
  type: 'LIKERT_SCALE';
  scale: 3 | 5 | 7; // Number of points in the scale
  labels?: Record<number, string>; // Custom labels for each point, e.g., {1: 'Strongly Disagree', 5: 'Strongly Agree'}
  leftLabel?: string; // Label for the leftmost point (e.g., "Disagree")
  rightLabel?: string; // Label for the rightmost point (e.g., "Agree")
  showLabels?: boolean; // Whether to show left/right labels
}

export interface SliderQuestion extends BaseQuestion {
  type: 'SLIDER';
  min: number;
  max: number;
  step?: number;
  unit?: string;
  prefix?: string;
  suffix?: string;
  showValue?: boolean;
  leftLabel?: string;
  midLabel?: string;
  rightLabel?: string;
}

// Union type for all question types
export type FormQuestion = 
  | ShortTextQuestion
  | LongTextQuestion
  | NumberQuestion
  | EmailQuestion
  | PhoneQuestion
  | SingleChoiceQuestion
  | MultipleChoiceQuestion
  | DateQuestion
  | LocationQuestion
  | MediaUploadQuestion
  | LikertScaleQuestion
  | SliderQuestion;

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  order: number;
  questions: FormQuestion[];
  config?: {
    repeatable?: boolean;
  };
  conditional?: {
    dependsOn?: string;
    showWhen?: string | number | boolean;
    operator?: 'EQUALS' | 'NOT_EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'CONTAINS';
    repeatable?: boolean;
  };
}

export interface FormSettings {
  requireAuthentication: boolean;
  allowAnonymous: boolean;
  notificationEmails: string[];
  expiryDate?: string;
}

export interface Form {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  projectName?: string; // For display purposes
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
  version: number;
  sections: FormSection[];
  settings: FormSettings;
  responseCount?: number;
  lastResponseAt?: string;
  tags?: string[];
  category?: string;
}

// Mobile-specific types for form responses
export type FormResponseStatus = 'draft' | 'ready_to_send' | 'sent' | 'failed';

export interface LocalFormResponse {
  id: string;
  formId: string;
  formTitle?: string; // Denormalized for display
  data: Record<string, any>; // Response data
  status: FormResponseStatus;
  isComplete: boolean;
  createdAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
  syncedAt?: number; // Unix timestamp when synced
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'failed';
  errorMessage?: string;
}

// Downloaded form metadata
export interface DownloadedForm {
  id: string;
  formId: string; // Reference to server form ID
  title: string;
  description?: string;
  projectId: string;
  projectName?: string;
  version: number;
  downloadedAt: number; // Unix timestamp
  updatedAt: number; // Unix timestamp
  formData: Form; // Full form definition stored locally
}

// Media attachment for local storage
export interface LocalMediaAttachment {
  id: string;
  responseId: string;
  questionId: string;
  filePath: string; // Local file path
  fileName: string;
  fileType: string;
  fileSize: number;
  uploaded: boolean;
  uploadUrl?: string; // URL after upload to Supabase Storage
  syncStatus?: 'pending' | 'uploading' | 'uploaded' | 'failed';
}

