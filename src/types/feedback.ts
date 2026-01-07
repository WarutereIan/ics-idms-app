// Feedback system types and classifications

export type FeedbackType = 
  | 'GENERAL'           // General feedback about the program
  | 'ISSUE'             // Reporting an issue or problem
  | 'EMERGENCY'         // Emergency situation requiring immediate attention
  | 'COMPLAINT'         // Formal complaint
  | 'SUGGESTION'        // Improvement suggestion
  | 'STAFF_FEEDBACK'    // Feedback about program staff
  | 'COMMUNITY_CONCERN' // Community-related concerns
  | 'SAFETY_INCIDENT'   // Safety-related incidents
  | 'RESOURCE_ISSUE'    // Issues with resources or materials
  | 'PROCESS_FEEDBACK'; // Feedback about program processes

export type FeedbackPriority = 
  | 'LOW'       // Can be addressed in normal timeframe
  | 'MEDIUM'    // Should be addressed within a few days
  | 'HIGH'      // Urgent, should be addressed within 24 hours
  | 'CRITICAL'; // Emergency, immediate attention required

export type FeedbackStatus = 
  | 'SUBMITTED'     // Initial submission
  | 'ACKNOWLEDGED'  // Received and acknowledged
  | 'IN_PROGRESS'   // Being worked on
  | 'RESOLVED'      // Issue resolved
  | 'CLOSED'        // Feedback closed
  | 'ESCALATED';    // Escalated to higher level

export type FeedbackSensitivity = 
  | 'PUBLIC'      // Can be shared openly
  | 'INTERNAL'    // Internal to project team
  | 'CONFIDENTIAL' // Confidential, limited access
  | 'SENSITIVE';   // Highly sensitive, admin only

export type EscalationLevel = 
  | 'NONE'        // No escalation needed
  | 'PROJECT'     // Escalate to project admin
  | 'REGIONAL'    // Escalate to regional manager
  | 'NATIONAL'    // Escalate to national office
  | 'EMERGENCY';  // Emergency escalation

export interface FeedbackCategory {
  id: string;
  name: string;
  description: string;
  type: FeedbackType;
  defaultPriority: FeedbackPriority;
  defaultSensitivity: FeedbackSensitivity;
  escalationLevel: EscalationLevel;
  requiresImmediateNotification: boolean;
  allowedStakeholders: string[]; // Types of stakeholders who can submit this feedback
}

export interface FeedbackForm {
  id: string;
  projectId: string;
  title: string;
  description: string;
  category: FeedbackCategory;
  isActive: boolean;
  allowAnonymous: boolean;
  requireAuthentication: boolean;
  sections: FeedbackFormSection[];
  settings: FeedbackFormSettings;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface FeedbackFormSection {
  id: string;
  title: string;
  description?: string;
  order: number;
  questions: FeedbackQuestion[];
}

export interface FeedbackQuestion {
  id: string;
  sectionId: string;
  type: FeedbackQuestionType;
  title: string;
  description?: string;
  order: number;
  isRequired: boolean;
  config: any;
  conditional?: any;
}

export type FeedbackQuestionType = 
  | 'SHORT_TEXT'
  | 'LONG_TEXT'
  | 'NUMBER'
  | 'EMAIL'
  | 'PHONE'
  | 'DATE'
  | 'DATETIME'
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'YES_NO'
  | 'LIKERT_SCALE'
  | 'LOCATION'
  | 'IMAGE_UPLOAD'
  | 'FILE_UPLOAD'
  | 'STAKEHOLDER_TYPE'    // Special question type for stakeholder identification
  | 'PRIORITY_SELECTION'  // Special question type for priority selection
  | 'ESCALATION_LEVEL';   // Special question type for escalation level

export interface FeedbackFormSettings {
  allowAnonymous: boolean;
  requireAuthentication: boolean;
  autoAssignPriority: boolean;
  autoEscalate: boolean;
  notificationEmails: string[];
  escalationRules: EscalationRule[];
  confidentialityLevel: FeedbackSensitivity;
  responseRequired: boolean;
  responseDeadline?: number; // Hours
}

export interface EscalationRule {
  id: string;
  condition: string; // e.g., "priority = 'CRITICAL'"
  escalationLevel: EscalationLevel;
  notificationEmails: string[];
  responseTime: number; // Hours
}

export interface FeedbackSubmission {
  id: string;
  formId: string;
  projectId: string;
  category: FeedbackCategory;
  priority: FeedbackPriority;
  sensitivity: FeedbackSensitivity;
  escalationLevel: EscalationLevel;
  
  // Submitter information
  submitterId?: string; // If authenticated
  submitterEmail?: string;
  submitterName?: string;
  stakeholderType?: string;
  isAnonymous: boolean;
  
  // Submission data
  data: any; // Form responses
  attachments: FeedbackAttachment[];
  
  // Status and workflow
  status: FeedbackStatus;
  assignedTo?: string;
  assignedAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  
  // Timestamps
  submittedAt: Date;
  updatedAt: Date;
  
  // Communication
  communications: FeedbackCommunication[];
  internalNotes: FeedbackNote[];
  statusHistory: FeedbackStatusHistory[];
}

export interface FeedbackStatusHistory {
  id: string;
  submissionId: string;
  status: FeedbackStatus;
  previousStatus?: FeedbackStatus;
  changedBy: string;
  changedByName: string;
  reason?: string;
  details?: string;
  assignedTo?: string;
  createdAt: Date;
}

export interface FeedbackAttachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: Date;
}

export interface CreateFeedbackSubmissionRequest {
  formId: string;
  categoryId: string;
  projectId?: string | null;
  priority: FeedbackPriority;
  sensitivity: FeedbackSensitivity;
  escalationLevel: EscalationLevel;
  submitterId?: string | null;
  submitterName?: string | null;
  submitterEmail?: string | null;
  stakeholderType?: string | null;
  isAnonymous?: boolean;
  data: Record<string, any>; // Form responses
  attachments?: FeedbackAttachment[];
}

export interface FeedbackCommunication {
  id: string;
  type: 'EMAIL' | 'SMS' | 'INTERNAL_NOTE' | 'PUBLIC_RESPONSE';
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
  sentBy?: string;
  sentTo?: string;
  sentAt: Date;
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
}

export interface FeedbackNote {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  isInternal: boolean;
  createdAt: Date;
}

export interface StakeholderType {
  id: string;
  name: string;
  description: string;
  canSubmitAnonymous: boolean;
  allowedFeedbackTypes: FeedbackType[];
  defaultSensitivity: FeedbackSensitivity;
}

// Default stakeholder types
export const DEFAULT_STAKEHOLDER_TYPES: StakeholderType[] = [
  {
    id: 'community_member',
    name: 'Community Member',
    description: 'Local community member participating in or affected by the program',
    canSubmitAnonymous: true,
    allowedFeedbackTypes: ['GENERAL', 'ISSUE', 'COMPLAINT', 'SUGGESTION', 'COMMUNITY_CONCERN', 'SAFETY_INCIDENT'],
    defaultSensitivity: 'PUBLIC'
  },
  {
    id: 'program_beneficiary',
    name: 'Program Beneficiary',
    description: 'Direct beneficiary of the program services',
    canSubmitAnonymous: true,
    allowedFeedbackTypes: ['GENERAL', 'ISSUE', 'COMPLAINT', 'SUGGESTION', 'STAFF_FEEDBACK', 'RESOURCE_ISSUE'],
    defaultSensitivity: 'INTERNAL'
  },
  {
    id: 'observer',
    name: 'Observer',
    description: 'External observer monitoring program implementation',
    canSubmitAnonymous: false,
    allowedFeedbackTypes: ['GENERAL', 'ISSUE', 'SUGGESTION', 'PROCESS_FEEDBACK'],
    defaultSensitivity: 'CONFIDENTIAL'
  },
  {
    id: 'partner_organization',
    name: 'Partner Organization',
    description: 'Partner organization working with the program',
    canSubmitAnonymous: false,
    allowedFeedbackTypes: ['GENERAL', 'ISSUE', 'SUGGESTION', 'PROCESS_FEEDBACK', 'RESOURCE_ISSUE'],
    defaultSensitivity: 'INTERNAL'
  },
  {
    id: 'government_official',
    name: 'Government Official',
    description: 'Government official involved in or overseeing the program',
    canSubmitAnonymous: false,
    allowedFeedbackTypes: ['GENERAL', 'ISSUE', 'COMPLAINT', 'SUGGESTION', 'PROCESS_FEEDBACK'],
    defaultSensitivity: 'CONFIDENTIAL'
  }
];

// Default feedback categories
export const DEFAULT_FEEDBACK_CATEGORIES: FeedbackCategory[] = [
  {
    id: 'general_feedback',
    name: 'General Feedback',
    description: 'General comments, suggestions, or observations about the program',
    type: 'GENERAL',
    defaultPriority: 'LOW',
    defaultSensitivity: 'PUBLIC',
    escalationLevel: 'NONE',
    requiresImmediateNotification: false,
    allowedStakeholders: ['community_member', 'program_beneficiary', 'observer', 'partner_organization']
  },
  {
    id: 'safety_incident',
    name: 'Safety Incident',
    description: 'Report safety concerns or incidents',
    type: 'SAFETY_INCIDENT',
    defaultPriority: 'HIGH',
    defaultSensitivity: 'CONFIDENTIAL',
    escalationLevel: 'PROJECT',
    requiresImmediateNotification: true,
    allowedStakeholders: ['community_member', 'program_beneficiary', 'observer', 'partner_organization']
  },
  {
    id: 'staff_feedback',
    name: 'Staff Feedback',
    description: 'Feedback about program staff performance or behavior',
    type: 'STAFF_FEEDBACK',
    defaultPriority: 'MEDIUM',
    defaultSensitivity: 'CONFIDENTIAL',
    escalationLevel: 'PROJECT',
    requiresImmediateNotification: false,
    allowedStakeholders: ['community_member', 'program_beneficiary', 'observer']
  },
  {
    id: 'emergency_report',
    name: 'Emergency Report',
    description: 'Report emergency situations requiring immediate attention',
    type: 'EMERGENCY',
    defaultPriority: 'CRITICAL',
    defaultSensitivity: 'SENSITIVE',
    escalationLevel: 'EMERGENCY',
    requiresImmediateNotification: true,
    allowedStakeholders: ['community_member', 'program_beneficiary', 'observer', 'partner_organization', 'government_official']
  },
  {
    id: 'resource_issue',
    name: 'Resource Issue',
    description: 'Report issues with program resources, materials, or facilities',
    type: 'RESOURCE_ISSUE',
    defaultPriority: 'MEDIUM',
    defaultSensitivity: 'INTERNAL',
    escalationLevel: 'PROJECT',
    requiresImmediateNotification: false,
    allowedStakeholders: ['program_beneficiary', 'partner_organization']
  },
  {
    id: 'process_feedback',
    name: 'Process Feedback',
    description: 'Feedback about program processes, procedures, or implementation',
    type: 'PROCESS_FEEDBACK',
    defaultPriority: 'LOW',
    defaultSensitivity: 'INTERNAL',
    escalationLevel: 'NONE',
    requiresImmediateNotification: false,
    allowedStakeholders: ['observer', 'partner_organization', 'government_official']
  }
];
