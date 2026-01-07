# React Native Data Collection App - Implementation Plan

## Overview

This document outlines the implementation plan for `dimes-collect`, a React Native mobile app that serves as the data collection frontend for the ICS Dashboard system. The app will enable offline data collection with online synchronization, following KoboCollect's interface patterns while reusing core logic from the existing `dimes-idms` web application.

## Architecture Overview

### Core Principles
1. **Offline-First**: All data collection works offline, with automatic sync when online
2. **Code Reusability**: Share business logic, types, and utilities between web and mobile
3. **KoboCollect-Inspired UX**: Familiar interface patterns for field data collectors
4. **Supabase Backend**: Same backend API as web application

### Technology Stack
- **Framework**: React Native with Expo (~54.0.30)
- **Navigation**: Expo Router (file-based routing)
- **State Management**: React Context API (matching web app pattern)
- **Offline Storage**:   
  - `@react-native-async-storage/async-storage` for key-value storage
  - `expo-sqlite` for local database (form responses, drafts)
- **Backend**: Supabase (same instance as web app)
- **Media Handling**: 
  - `expo-image-picker` for photos/videos
  - `expo-media-library` for media access
  - `expo-location` for GPS coordinates
  - `expo-file-system` for file management
- **Network**: `@react-native-community/netinfo` for connectivity monitoring
- **Forms**: Custom renderers adapted from web app

## Project Structure

```
dimes-collect/
├── app/                          # Expo Router pages
│   ├── (auth)/                   # Authentication screens
│   │   ├── login.tsx
│   │   └── _layout.tsx
│   ├── (tabs)/                   # Main app tabs
│   │   ├── index.tsx             # Home screen with "Start new form" button
│   │   ├── drafts.tsx            # Drafts tab (incomplete responses)
│   │   ├── ready-to-send.tsx     # Ready to send tab (ready for sync)
│   │   ├── sent.tsx              # Sent tab (submitted responses)
│   │   ├── download-form.tsx     # Download form tab (form selection by project)
│   │   ├── delete-form.tsx       # Delete form tab (remove downloaded forms)
│   │   └── _layout.tsx
│   ├── form/                     # Form filling screens
│   │   ├── [formId]/
│   │   │   ├── fill.tsx          # Form filling interface
│   │   │   └── [responseId]/
│   │   │       └── edit.tsx      # Edit existing response (draft or ready_to_send)
│   │   └── _layout.tsx
│   └── _layout.tsx               # Root layout
├── src/
│   ├── components/
│   │   ├── forms/                # Form-related components
│   │   │   ├── FormList.tsx      # List of available forms
│   │   │   ├── FormCard.tsx      # Form card component
│   │   │   ├── FormFiller.tsx    # Main form filling component
│   │   │   └── FormProgress.tsx  # Progress indicator
│   │   ├── questions/            # Question renderers (adapted from web)
│   │   │   ├── BaseQuestionRenderer.tsx
│   │   │   ├── ShortTextQuestionRenderer.tsx
│   │   │   ├── NumberQuestionRenderer.tsx
│   │   │   ├── SingleChoiceQuestionRenderer.tsx
│   │   │   ├── MultipleChoiceQuestionRenderer.tsx
│   │   │   ├── DateQuestionRenderer.tsx
│   │   │   ├── LocationQuestionRenderer.tsx
│   │   │   ├── MediaUploadQuestionRenderer.tsx
│   │   │   ├── LikertScaleQuestionRenderer.tsx
│   │   │   └── SliderQuestionRenderer.tsx
│   │   ├── submissions/         # Submission management
│   │   │   ├── SubmissionQueue.tsx
│   │   │   ├── SubmissionCard.tsx
│   │   │   └── SyncIndicator.tsx
│   │   ├── ui/                   # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   └── Badge.tsx
│   │   └── common/               # Common components
│   │       ├── OfflineBanner.tsx
│   │       ├── LoadingSpinner.tsx
│   │       └── ErrorBoundary.tsx
│   ├── contexts/                 # React Context providers
│   │   ├── AuthContext.tsx       # Authentication (adapted from web)
│   │   ├── FormContext.tsx       # Form management (adapted from web)
│   │   ├── OfflineContext.tsx    # Offline sync management
│   │   └── NetworkContext.tsx    # Network status
│   ├── services/                 # Business logic services
│   │   ├── supabaseClient.ts     # Supabase client setup
│   │   ├── supabaseAuthService.ts # Auth service (shared logic)
│   │   ├── supabaseFormsService.ts # Forms service (shared logic)
│   │   ├── offlineStorage.ts     # Local storage abstraction
│   │   ├── syncService.ts        # Sync queue management
│   │   └── mediaService.ts       # Media file handling
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAuth.ts            # Auth hook
│   │   ├── useForms.ts           # Forms hook
│   │   ├── useOfflineSync.ts     # Offline sync hook
│   │   ├── useNetworkStatus.ts   # Network monitoring
│   │   └── useFormFiller.ts     # Form filling logic
│   ├── utils/                    # Utility functions
│   │   ├── formUtils.ts          # Form utilities (shared)
│   │   ├── questionUtils.ts      # Question utilities (shared)
│   │   ├── validation.ts         # Validation logic (shared)
│   │   ├── dateUtils.ts          # Date formatting
│   │   └── storageUtils.ts       # Storage helpers
│   ├── types/                    # TypeScript types
│   │   ├── forms.ts              # Form types (shared from web)
│   │   ├── dashboard.ts          # Dashboard types (shared)
│   │   ├── supabase.ts           # Supabase types (shared)
│   │   └── navigation.ts          # Navigation types
│   └── constants/                # Constants
│       ├── config.ts             # App configuration
│       └── theme.ts              # Theme constants
├── shared/                       # Shared code with web app (symlink or copy)
│   ├── types/                    # Shared TypeScript types
│   ├── utils/                    # Shared utility functions
│   └── services/                # Shared service logic
└── package.json
```

## Code Sharing Strategy

### 1. Shared Types
- **Location**: `dimes-idms/src/types/` → Copy to `dimes-collect/src/types/`
- **Types to Share**:
  - `dashboard.ts` - User, Project, Form types
  - `supabase.ts` - Database types
  - Form question types from `form-creation-wizard/types`

### 2. Shared Services
- **Location**: `dimes-idms/src/services/` → Adapt for React Native
- **Services to Adapt**:
  - `supabaseAuthService.ts` - Authentication logic
  - `supabaseFormsService.ts` - Form CRUD operations
  - Keep business logic, replace web-specific APIs

### 3. Shared Utilities
- **Location**: `dimes-idms/src/components/dashboard/form-preview/utils/`
- **Utilities to Share**:
  - `questionUtils.ts` - Question filtering, conditional logic
  - Validation functions
  - Form data transformation

### 4. Question Renderers
- **Strategy**: Create React Native versions of web renderers
- **Location**: `dimes-collect/src/components/questions/`
- **Adaptation Required**:
  - Replace HTML inputs with React Native components
  - Use `TextInput`, `TouchableOpacity`, `Picker`, etc.
  - Adapt media upload to use `expo-image-picker`
  - Use `expo-location` for GPS

## Offline-First Implementation

### 1. Local Database Schema (SQLite)

```sql
-- Forms table (downloaded forms)
CREATE TABLE forms (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  project_id TEXT,
  sections TEXT, -- JSON string
  version INTEGER,
  downloaded_at INTEGER,
  updated_at INTEGER,
  status TEXT -- 'DRAFT', 'PUBLISHED', 'CLOSED'
);

-- Form responses (drafts and completed)
CREATE TABLE form_responses (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL,
  data TEXT, -- JSON string
  is_complete INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER,
  synced_at INTEGER, -- NULL if not synced
  sync_status TEXT DEFAULT 'pending', -- 'pending', 'syncing', 'synced', 'failed'
  FOREIGN KEY (form_id) REFERENCES forms(id)
);

-- Media attachments
CREATE TABLE media_attachments (
  id TEXT PRIMARY KEY,
  response_id TEXT NOT NULL,
  question_id TEXT,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded INTEGER DEFAULT 0,
  upload_url TEXT,
  FOREIGN KEY (response_id) REFERENCES form_responses(id)
);

-- Sync queue
CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'form_response', 'media_upload'
  data TEXT, -- JSON string
  status TEXT DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  created_at INTEGER,
  last_attempt_at INTEGER,
  error_message TEXT
);
```

### 2. Offline Sync Flow

```
┌─────────────────┐
│  User Fills Form │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Save to SQLite  │
│ (local storage) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Add to Sync Queue│
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│ Check Network    │─────▶│  Online?     │
└────────┬────────┘      └──────┬───────┘
         │                       │
    ┌────┴────┐            ┌─────┴─────┐
    │ Offline │            │  Online   │
    └────┬────┘            └─────┬─────┘
         │                        │
         │                        ▼
         │              ┌─────────────────┐
         │              │  Sync to Server │
         │              │  (Supabase API) │
         │              └────────┬────────┘
         │                       │
         │                  ┌─────┴─────┐
         │                  │  Success? │
         │                  └─────┬─────┘
         │                        │
         │                   ┌────┴────┐
         │                   │ Yes/No  │
         │                   └────┬───┘
         │                        │
         └────────────────────────┘
                    │
                    ▼
         ┌──────────────────┐
         │ Update Sync Status│
         └──────────────────┘
```

### 3. Sync Service Implementation

```typescript
// src/services/syncService.ts
class SyncService {
  // Check for pending items and sync when online
  async syncPendingItems(): Promise<SyncResult> {
    // 1. Get all pending items from sync_queue
    // 2. For each item:
    //    - If form_response: Submit via formsApi
    //    - If media_upload: Upload file to Supabase Storage
    // 3. Update sync status
    // 4. Retry failed items with exponential backoff
  }

  // Auto-sync when network comes back online
  setupAutoSync() {
    // Listen to network status changes
    // Trigger sync when online
  }
}
```

## Component Migration Plan

### Phase 1: Core Infrastructure (Week 1-2)
1. ✅ Set up Expo project structure
2. ✅ Set up Supabase client
3. ✅ Set up SQLite database
4. ✅ Implement offline storage service
5. ✅ Create sync service
6. Implement AuthContext (adapt from web)
7. Implement NetworkContext (monitor connectivity)
8. Create base UI components

### Phase 2: Form Context & Download Flow (Week 3-4)
1. Implement FormContext for mobile app:
   - Downloaded forms management
   - Form response status management (draft, ready_to_send, sent)
   - Integration with offline storage
2. Create Download Form screen:
   - Fetch forms from Supabase (filtered by organization/projects)
   - Group forms by project
   - Download form definitions to SQLite
   - Handle form updates/versioning
3. Create Delete Form screen:
   - List downloaded forms
   - Delete with cascade confirmation
   - Clean up associated responses

### Phase 3: Form Filling System (Week 5-6)
1. Create base question renderer
2. Implement core question types:
   - ShortText
   - Number
   - SingleChoice
   - MultipleChoice
   - Date
3. Form Filling UI:
   - Section-based navigation
   - Progress indicator
   - Draft auto-save (every 30 seconds)
   - Form validation
   - Save as draft / Mark as ready to send

### Phase 4: Advanced Question Types (Week 7-8)
1. LocationQuestionRenderer (GPS)
2. MediaUploadQuestionRenderer (camera/gallery)
3. LikertScaleQuestionRenderer
4. SliderQuestionRenderer
5. Conditional question logic
6. LongText, Email, Phone question types

### Phase 5: Main Screens & Navigation (Week 9-10)
1. Home screen (index.tsx):
   - "Start new form" button at top
   - Tab navigation setup
   - Response counts display
2. Drafts tab screen:
   - List draft responses
   - Edit/continue functionality
   - Move to ready_to_send
   - Delete drafts
3. Ready to Send tab screen:
   - List ready_to_send responses
   - Badge count indicator
   - Sync button
   - Edit before sending
   - Retry failed syncs
4. Sent tab screen:
   - List sent responses
   - Read-only view
   - Submission details
5. Tab navigation with icons and badges

### Phase 6: Sync & Status Management (Week 11-12)
1. Integrate sync service with Ready to Send screen
2. Auto-sync when online (optional setting)
3. Manual sync trigger
4. Sync status indicators (pending, syncing, synced, failed)
5. Media upload integration
6. Error handling and retry logic
7. Success/failure notifications

### Phase 7: Polish & Testing (Week 13-14)
1. KoboCollect-inspired UI/UX (dark theme option)
2. Error handling improvements
3. Performance optimization
4. Testing on iOS/Android devices
5. Offline scenario testing
6. Sync reliability testing
7. Documentation

## Required Dependencies

### Core Dependencies
```json
{
  "@supabase/supabase-js": "^2.39.0",
  "@react-native-async-storage/async-storage": "^1.21.0",
  "expo-sqlite": "~14.0.7",
  "@react-native-community/netinfo": "^11.1.0",
  "expo-image-picker": "~16.0.4",
  "expo-media-library": "~17.0.3",
  "expo-location": "~18.0.4",
  "expo-file-system": "~18.0.3",
  "react-native-gesture-handler": "~2.28.0",
  "react-native-reanimated": "~4.1.1"
}
```

### Development Dependencies
```json
{
  "@types/react-native": "^0.72.0",
  "typescript": "~5.9.2"
}
```

## Key Implementation Details

### App Flow (Based on KoboCollect Pattern)

1. **Main Screen (Home Tab)**
   - **"Start new form" button** (top): Opens form selection from downloaded forms
   - User selects a downloaded form
   - Starts filling the form
   - Can save as **draft** or mark as **ready to send**

2. **Drafts Tab**
   - Shows all responses with status `draft`
   - Users can edit and continue filling
   - Can move to "ready to send" when complete

3. **Ready to Send Tab**
   - Shows all responses with status `ready_to_send`
   - Badge showing count (e.g., "1")
   - Users can still edit before sending
   - Only these responses are available for submission/sync
   - Sync happens when online

4. **Sent Tab**
   - Shows all responses with status `sent`
   - Read-only view of submitted responses
   - Shows sync timestamp

5. **Download Form Tab**
   - Lists forms grouped by project
   - Only shows forms user has access to (organization + project permissions)
   - User selects which forms to download to device
   - Downloads and stores form definition locally in SQLite
   - Can update downloaded forms if server version is newer

6. **Delete Form Tab**
   - Lists all downloaded forms
   - User can delete forms from device
   - Cascade deletes any associated responses (drafts/ready to send)

### 1. Authentication Flow
- Use Supabase Auth (same as web)
- Store session in AsyncStorage
- Auto-refresh tokens
- Handle offline login (queue for sync)

### 2. Form Download
- Fetch available forms from Supabase (filtered by user's organization and projects)
- Group forms by project
- Store form definitions in SQLite when downloaded
- Handle form updates/versioning
- Only downloaded forms can be filled

### 3. Form Filling
- Section-based navigation (like KoboCollect)
- Auto-save drafts every 30 seconds
- Support repeatable sections
- Conditional question logic
- Validation on each question
- Status management: `draft` → `ready_to_send` → `sent`

### 4. Media Handling
- Capture photos/videos with camera
- Select from gallery
- Compress images before storage
- Store media locally until response is synced
- Upload to Supabase Storage when syncing ready_to_send responses

### 5. GPS/Location
- Capture GPS coordinates
- Support manual location entry
- Store location accuracy metadata
- Handle location permissions

### 6. Sync Strategy
- Only sync responses with status `ready_to_send`
- Background sync when app opens (if online)
- Manual sync trigger from Ready to Send tab
- Upload media files first, then submit response
- Update status to `sent` after successful sync
- Retry failed items with manual retry option
- Show sync progress and status

## Application Flow (KoboCollect-Inspired)

### Main Screen Structure
The app follows a tab-based navigation with a primary action button at the top:

```
┌─────────────────────────────────┐
│  [Project Name]        [Avatar] │
│                                  │
│  [  + Start new form  ]         │ ← Primary Action Button
│                                  │
│  ┌──────────────────────────┐  │
│  │  ✏️ Drafts               │  │ ← Tab 1
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │
│  │  ✈️ Ready to send   [1]  │  │ ← Tab 2 (with badge count)
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │
│  │  ✅ Sent                 │  │ ← Tab 3
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │
│  │  ⬇️ Download form        │  │ ← Tab 4
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │
│  │  🗑️ Delete form         │  │ ← Tab 5
│  └──────────────────────────┘  │
└─────────────────────────────────┘
```

### Detailed Flow Description

#### 1. Start New Form Flow
**Trigger:** User taps "Start new form" button at the top
- Shows list of **downloaded forms** only (cannot fill forms not downloaded)
- User selects a form
- Opens form filling interface
- User fills form section by section
- **Options:**
  - **Save as Draft**: Saves incomplete response with status `draft`
  - **Mark as Ready to Send**: Marks complete response with status `ready_to_send`
- Form can only be submitted/synced when status is `ready_to_send`

#### 2. Drafts Tab/Screen
**Purpose:** Manage incomplete form responses
- Lists all responses with status `draft`
- Shows form title, last updated timestamp
- **Actions:**
  - **Tap to Edit**: Opens form filler with existing data
  - **Continue Filling**: User can complete the form
  - **Mark as Ready to Send**: Moves response to `ready_to_send` status
  - **Delete**: Remove draft response (with confirmation)

**Key Features:**
- Editable at any time
- Auto-saves progress every 30 seconds
- Can be moved to "Ready to send" when complete
- No sync/submission until moved to "Ready to send"

#### 3. Ready to Send Tab/Screen
**Purpose:** Manage completed responses ready for submission
- Lists all responses with status `ready_to_send`
- Shows **badge count** (e.g., "1", "3") indicating number of pending submissions
- **Actions:**
  - **Tap to Edit**: Still editable before sending
  - **Send/Sync**: Triggers sync to server (when online)
  - **Delete**: Remove response (with confirmation)
- **Sync Behavior:**
  - Only responses in this tab can be synced
  - Sync happens automatically when online (optional) or manually via button
  - Shows sync status (pending, syncing, synced, failed)
  - On successful sync, status changes to `sent`

**Key Features:**
- Still editable (users can review before sending)
- Only responses here are available for submission
- Sync indicator shows which are syncing/synced
- Failed syncs remain here for retry

#### 4. Sent Tab/Screen
**Purpose:** View successfully submitted responses
- Lists all responses with status `sent`
- Shows form title, submission timestamp
- **Read-only view**
- **Actions:**
  - **View**: Open read-only view of submitted response
  - **View Details**: Show sync timestamp, response ID

**Key Features:**
- Read-only (cannot edit after sent)
- Serves as submission history
- Can view details but not modify
- Shows confirmation that data was successfully submitted

#### 5. Download Form Tab/Screen
**Purpose:** Download forms to device for offline use
- **Forms are grouped by Project**
- Only shows forms from:
  - User's organization
  - Projects user has access to (permissions-based)
- For each form:
  - Form title and description
  - Project name
  - Download status (not downloaded, downloaded, update available)
  - **Actions:**
    - **Download**: Download form definition to device
    - **Update**: Update if newer version exists on server
    - **Cancel Download**: Remove downloaded form
- **Filtering:**
  - Filter by project
  - Search by form title

**Key Features:**
- Must download form before it can be filled
- Form definitions stored locally in SQLite
- Can update forms if server version is newer
- Only accessible forms are shown (respects permissions)

#### 6. Delete Form Tab/Screen
**Purpose:** Remove downloaded forms from device
- Lists all **downloaded forms** (not all available forms)
- Shows form title, project, download date
- **Actions:**
  - **Delete**: Remove form from device
  - **Confirm Delete**: With warning about associated responses
- **Cascade Behavior:**
  - Deleting a form also deletes:
    - All draft responses for that form
    - All ready_to_send responses for that form
    - All sent responses for that form (optional - may want to keep history)
  - Shows confirmation with count of responses that will be deleted

**Key Features:**
- Only downloaded forms appear here
- Warns about data loss
- Provides cleanup functionality
- Cannot delete if form is currently being filled

### Form Filling Interface

#### Navigation Pattern
- **Section-based navigation** (similar to KoboCollect)
- Section tabs at top or side menu
- Progress indicator showing completion
- Previous/Next buttons for section navigation
- Jump to section menu for quick navigation

#### Auto-save Behavior
- Auto-saves draft every 30 seconds
- Manual "Save Draft" button available
- Shows "Saved" indicator after auto-save
- Saves state when navigating away

#### Completion & Submission
- Form validation on each question
- Required field indicators
- "Mark as Ready to Send" button appears when form is complete
- Can save as draft even when complete (for review)
- Once marked "Ready to Send", appears in Ready to Send tab

### Sync Flow

1. **User marks response as "Ready to Send"**
   - Status changes from `draft` to `ready_to_send`
   - Response appears in Ready to Send tab

2. **When Online:**
   - Manual sync: User taps "Sync" button
   - Auto sync: Optionally sync automatically when online
   - Sync service processes all `ready_to_send` responses

3. **Sync Process:**
   - Upload media attachments first (to Supabase Storage)
   - Submit form response (to Supabase `form_responses` table)
   - Update status to `sent` on success
   - Move response to Sent tab
   - Show success notification

4. **On Failure:**
   - Status remains `ready_to_send`
   - Shows error message
   - User can retry manually
   - Response stays in Ready to Send tab until successful

### Permission & Access Control

- **Form Access:**
  - Users only see forms from their organization
  - Users only see forms from projects they have access to
  - Permissions checked when fetching forms from server
  - Downloaded forms cached with access control

- **Response Access:**
  - Users can only see their own responses
  - Responses linked to user account
  - Organization/Project context preserved

## Testing Strategy

1. **Unit Tests**: Services, utilities, hooks
2. **Integration Tests**: Form filling flow, sync process
3. **E2E Tests**: Complete user journeys
4. **Device Testing**: iOS and Android devices
5. **Offline Testing**: Airplane mode scenarios
6. **Performance Testing**: Large forms, many submissions

## Security Considerations

1. **Data Encryption**: Encrypt sensitive form data in SQLite
2. **Secure Storage**: Use Expo SecureStore for auth tokens
3. **Media Permissions**: Request appropriate permissions
4. **Network Security**: Use HTTPS only
5. **Data Validation**: Validate all inputs before sync

## Performance Optimization

1. **Lazy Loading**: Load forms on demand
2. **Image Compression**: Compress images before storage
3. **Database Indexing**: Index frequently queried fields
4. **Batch Sync**: Sync multiple items in batches
5. **Background Processing**: Use background tasks for sync

## Implementation Priority

### Critical Path (Must Have)
1. **Core Infrastructure** (Week 1-2)
   - Auth, Network, Form contexts
   - Offline storage (✅ Done)
   - Sync service (✅ Done)

2. **Download Form Flow** (Week 3-4)
   - Download Form screen
   - Form storage and management
   - Delete Form screen

3. **Form Filling** (Week 5-8)
   - Base question renderers
   - Core question types
   - Form filling UI with section navigation
   - Draft/Ready to send status management

4. **Main Screens** (Week 9-10)
   - Home screen with tabs
   - Drafts, Ready to Send, Sent screens
   - Navigation between screens

5. **Sync Integration** (Week 11-12)
   - Sync with Ready to Send screen
   - Status indicators
   - Error handling

### Nice to Have (Can be Added Later)
- Advanced question types (some can be MVP basic)
- Auto-sync (manual sync for MVP is fine)
- Form versioning UI improvements
- Bulk operations
- Search functionality
- Analytics

## Notes

- **Offline-First**: All functionality must work offline
- **Status-Based Workflow**: Draft → Ready to Send → Sent is core to the flow
- **Download Requirement**: Forms must be downloaded before filling
- **Permission-Based**: Only show forms user has access to
- **KoboCollect UX**: Follow familiar patterns for field data collectors
- **Test on Low-End Devices**: Ensure performance on budget Android devices
- **Battery Considerations**: GPS and camera features should be power-efficient
- **Data Privacy**: All data stored locally, only synced when explicitly sent

## Success Criteria

1. ✅ User can download forms from their accessible projects
2. ✅ User can fill forms offline
3. ✅ User can save drafts and continue later
4. ✅ User can mark responses as ready to send
5. ✅ User can sync ready_to_send responses when online
6. ✅ User can view sent responses
7. ✅ All data persists locally
8. ✅ Forms respect organization/project permissions

