import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, Plus, X } from 'lucide-react-native';
import { Button } from '@/components/ui';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Text } from '@/components/ui/text';
import { Progress } from '@/components/ui/Progress';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { QuestionRenderer } from '@/components/questions/QuestionRenderer';
import { useForm } from '@/contexts/FormContext';
import { useNetwork } from '@/contexts/NetworkContext';
import { Form, FormSection, FormQuestion, LocalFormResponse } from '@/types/forms';
import { filterMainQuestions, getConditionalQuestionsForOption, validateQuestion } from '@/utils/questionUtils';
import { checkFormVersion, updateDownloadedFormVersion } from '@/services/formVersionService';
import { cn } from '@/lib/utils';

export default function FillFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { formId, responseId, readOnly } = useLocalSearchParams<{ formId: string; responseId?: string; readOnly?: string }>();
  const isReadOnly = readOnly === 'true';
  const { downloadedForms, getResponse, createResponse, updateResponse, updateResponseStatus, refreshResponses } = useForm();
  const { isOnline, isConnected, sync: syncAll, isSyncing } = useNetwork();

  const [form, setForm] = useState<Form | null>(null);
  const [currentResponse, setCurrentResponse] = useState<LocalFormResponse | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [conditionalResponses, setConditionalResponses] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [formVersionStatus, setFormVersionStatus] = useState<{ needsUpdate: boolean; message?: string } | null>(null);
  // Track number of instances per section to support repeatable sections
  const [sectionInstanceCounts, setSectionInstanceCounts] = useState<Record<string, number>>({});

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const AUTO_SAVE_DELAY = 2000; // 2 seconds

  // Helpers for repeatable sections
  const getSectionInstanceCount = (sectionId: string) => {
    // For backwards compatibility: only use instance counts for repeatable sections
    const section = form?.sections?.find(s => s.id === sectionId);
    const isRepeatable = (section as any)?.conditional?.repeatable === true;
    return isRepeatable ? (sectionInstanceCounts[sectionId] ?? 1) : 1;
  };

  const updateSectionInstanceCount = (sectionId: string, next: number) => {
    setSectionInstanceCounts(prev => ({ ...prev, [sectionId]: Math.max(1, next) }));
  };

  const getInstanceScopedQuestionId = (baseQuestionId: string, instanceIndex: number) => {
    // For backwards compatibility: only add instance suffix for repeatable sections
    const question = form?.sections?.flatMap(s => s.questions || [])?.find(q => q.id === baseQuestionId);
    const section = form?.sections?.find(s => s.questions?.some(q => q.id === baseQuestionId));
    const isRepeatable = (section as any)?.conditional?.repeatable === true;
    return isRepeatable ? `${baseQuestionId}__i${instanceIndex}` : baseQuestionId;
  };

  // Load form and response
  useEffect(() => {
    loadFormAndResponse();
  }, [formId, responseId]);

  // Check form version on mount and periodically
  useEffect(() => {
    if (!form?.id || !isOnline) return;

    const checkVersion = async () => {
      try {
        const versionCheck = await checkFormVersion(formId);
        if (versionCheck.needsUpdate) {
          setFormVersionStatus({
            needsUpdate: true,
            message: versionCheck.message,
          });
        } else {
          setFormVersionStatus(null);
        }
      } catch (error) {
        console.error('Error checking form version:', error);
      }
    };

    checkVersion();
    const intervalId = setInterval(checkVersion, 60000); // Check every minute

    return () => clearInterval(intervalId);
  }, [form?.id, formId, isOnline]);

  const loadFormAndResponse = async () => {
    console.log('🔄 [loadFormAndResponse] Loading form and response:', {
      formId,
      responseId,
      isReadOnly,
      downloadedFormsCount: downloadedForms.length
    });

    setIsLoading(true);
    try {
      // Find downloaded form
      const downloadedForm = downloadedForms.find((df: any) => df.formId === formId);
      if (!downloadedForm) {
        console.error('❌ [loadFormAndResponse] Downloaded form not found:', {
          formId,
          availableFormIds: downloadedForms.map((df: any) => df.formId)
        });
        Alert.alert('Error', 'Form not found. Please download the form first.');
        router.back();
        return;
      }

      console.log('📋 [loadFormAndResponse] Found downloaded form:', {
        id: downloadedForm.id,
        formId: downloadedForm.formId,
        title: downloadedForm.title,
        version: downloadedForm.version,
        sectionsCount: downloadedForm.formData.sections?.length || 0
      });

      // Transform form to extract options and other config properties from questions
      const transformQuestionData = (question: any) => {
        if (!question.config) return question;
        
        // Extract options from config if they exist
        const config = typeof question.config === 'string' ? JSON.parse(question.config) : question.config;
        
        return {
          ...question,
          options: config.options || [],
          // Extract other config properties that might be expected at top level
          placeholder: config.placeholder,
          min: config.min,
          max: config.max,
          step: config.step,
          allowOther: config.allowOther,
          maxSelections: config.maxSelections,
          displayType: config.displayType,
          statements: config.statements,
          defaultScaleType: config.defaultScaleType,
          defaultLabels: config.defaultLabels,
          // Preserve the original config
          config
        };
      };

      const transformedForm: Form = {
        ...downloadedForm.formData,
        sections: (downloadedForm.formData.sections || []).map((section: any) => ({
          ...section,
          questions: (section.questions || []).map(transformQuestionData),
        })),
      };

      console.log('🔄 [loadFormAndResponse] Transformed form questions:', {
        sectionsCount: transformedForm.sections.length,
        questionsWithOptions: transformedForm.sections.flatMap(s => s.questions).filter(q => 
          (q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') && (q.options?.length || 0) > 0
        ).length,
        sampleQuestion: transformedForm.sections.flatMap(s => s.questions).find(q => 
          q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE'
        ) ? {
          id: transformedForm.sections.flatMap(s => s.questions).find(q => 
            q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE'
          )?.id,
          type: transformedForm.sections.flatMap(s => s.questions).find(q => 
            q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE'
          )?.type,
          optionsCount: transformedForm.sections.flatMap(s => s.questions).find(q => 
            q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE'
          )?.options?.length || 0
        } : null
      });

      setForm(transformedForm);

      // Load existing response if editing
      if (responseId) {
        const response = await getResponse(responseId);
        if (response) {
          setCurrentResponse(response);
          
          // Handle both merged data and separate conditional data for backward compatibility
          const responseData = response.data || {};
          const conditionalData = (response as any).conditionalData || {};
          
          // Separate main responses from conditional responses
          // For backward compatibility, check if conditionalData exists separately
          if (Object.keys(conditionalData).length > 0) {
            // Data was stored separately (old format)
            setResponses(responseData);
            setConditionalResponses(conditionalData);
          } else {
            // Data was stored merged (new format) - need to separate them
            const mainResponses: Record<string, any> = {};
            const condResponses: Record<string, any> = {};
            
            // Get all questions to determine which are conditional
            const allQuestions = downloadedForm.formData.sections.flatMap((section: any) => section.questions);
            
            Object.entries(responseData).forEach(([questionId, value]) => {
              // Check if this is a conditional question
              const isConditional = allQuestions.some((q: any) => {
                if (q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') {
                  const options = q.options || [];
                  return options.some((opt: any) => 
                    opt.conditionalQuestions?.some((cq: any) => cq.id === questionId)
                  );
                }
                return false;
              });
              
              if (isConditional) {
                condResponses[questionId] = value;
              } else {
                mainResponses[questionId] = value;
              }
            });
            
            setResponses(mainResponses);
            setConditionalResponses(condResponses);
          }
          
          // Find section index from response
          if ((response as any).currentSectionIndex !== undefined) {
            setCurrentSectionIndex((response as any).currentSectionIndex);
          }
          
          // Restore section instance counts for repeatable sections
          if ((response as any).sectionInstanceCounts) {
            console.log('🔄 [loadFormAndResponse] Restoring section instance counts:', (response as any).sectionInstanceCounts);
            setSectionInstanceCounts((response as any).sectionInstanceCounts);
          }
        }
      }

      console.log('✅ [loadFormAndResponse] Form and response loaded successfully:', {
        formLoaded: !!form,
        responseLoaded: !!currentResponse,
        responsesCount: Object.keys(responses).length,
        conditionalResponsesCount: Object.keys(conditionalResponses).length,
        currentSectionIndex
      });

    } catch (error) {
      console.error('❌ [loadFormAndResponse] Error loading form:', error);
      console.error('[loadFormAndResponse] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        formId,
        responseId
      });
      Alert.alert('Error', 'Failed to load form. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Check if there's actual input in responses
  const hasActualInput = (responsesObj: Record<string, any>, conditionalObj: Record<string, any>): boolean => {
    const allResponses = { ...responsesObj, ...conditionalObj };
    
    console.log('🔍 [hasActualInput] Checking for actual input:', {
      responsesKeys: Object.keys(responsesObj),
      conditionalKeys: Object.keys(conditionalObj),
      allResponsesKeys: Object.keys(allResponses),
      allResponsesSample: Object.entries(allResponses).slice(0, 3).reduce((acc, [key, value]) => {
        acc[key] = typeof value === 'object' ? JSON.stringify(value).substring(0, 50) : value;
        return acc;
      }, {} as Record<string, any>)
    });
    
    // Check if any response has a meaningful value
    const hasInput = Object.values(allResponses).some(value => {
      const isEmpty = value === null || 
                     value === undefined || 
                     (typeof value === 'string' && value.trim() === '') || 
                     (Array.isArray(value) && value.length === 0) || 
                     (typeof value === 'object' && Object.keys(value).length === 0);
      
      console.log('🔍 [hasActualInput] Value check:', { value, isEmpty, hasValue: !isEmpty });
      return !isEmpty;
    });

    console.log('🔍 [hasActualInput] Result:', { hasInput });
    return hasInput;
  };

  // Auto-save functionality
  useEffect(() => {
    console.log('🔄 [Auto-save] Effect triggered:', {
      hasForm: !!form,
      hasUnsavedChanges,
      responsesCount: Object.keys(responses).length,
      conditionalResponsesCount: Object.keys(conditionalResponses).length,
      currentSectionIndex
    });

    if (!form || !hasUnsavedChanges) {
      console.log('⏭️ [Auto-save] Skipping: no form or no unsaved changes');
      return;
    }

    // Only autosave if there's actual input
    const hasInput = hasActualInput(responses, conditionalResponses);
    console.log('🔍 [Auto-save] Input check:', {
      hasInput,
      responsesKeys: Object.keys(responses),
      conditionalResponsesKeys: Object.keys(conditionalResponses)
    });

    if (!hasInput) {
      console.log('⏭️ [Auto-save] Skipping: no actual input detected');
      return;
    }

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      console.log('⏰ [Auto-save] Clearing existing timer');
      clearTimeout(autoSaveTimerRef.current);
    }

    console.log('⏰ [Auto-save] Setting new auto-save timer for', AUTO_SAVE_DELAY, 'ms');
    
    // Set new timer
    autoSaveTimerRef.current = setTimeout(() => {
      console.log('💾 [Auto-save] Timer triggered - starting silent save');
      saveDraft(true); // Silent save
    }, AUTO_SAVE_DELAY) as unknown as NodeJS.Timeout;

    return () => {
      if (autoSaveTimerRef.current) {
        console.log('⏰ [Auto-save] Cleaning up timer on effect cleanup');
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [responses, conditionalResponses, currentSectionIndex, hasUnsavedChanges]);

  const handleResponseChange = (questionId: string, value: any) => {
    console.log('🔄 [handleResponseChange] Response changed:', {
      questionId,
      value: typeof value === 'object' ? JSON.stringify(value).substring(0, 100) : value,
      valueType: typeof value,
      previousValue: responses[questionId]
    });

    setResponses(prev => {
      const newResponses = {
        ...prev,
        [questionId]: value,
      };
      console.log('📋 [handleResponseChange] Updated responses state:', {
        totalCount: Object.keys(newResponses).length,
        allKeys: Object.keys(newResponses),
        changedQuestion: questionId
      });
      return newResponses;
    });
    
    setHasUnsavedChanges(true);
    console.log('✏️ [handleResponseChange] Marked as unsaved changes');
    
    // Clear error for this question
    if (errors[questionId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }
  };

  const handleConditionalChange = (questionId: string, value: any) => {
    console.log('🔄 [handleConditionalChange] Conditional response changed:', {
      questionId,
      value: typeof value === 'object' ? JSON.stringify(value).substring(0, 100) : value,
      valueType: typeof value,
      previousValue: conditionalResponses[questionId]
    });

    setConditionalResponses(prev => {
      const newConditionalResponses = {
        ...prev,
        [questionId]: value,
      };
      console.log('📋 [handleConditionalChange] Updated conditional responses state:', {
        totalCount: Object.keys(newConditionalResponses).length,
        allKeys: Object.keys(newConditionalResponses),
        changedQuestion: questionId
      });
      return newConditionalResponses;
    });
    
    setHasUnsavedChanges(true);
    console.log('✏️ [handleConditionalChange] Marked as unsaved changes');
    
    // Clear error for this question
    if (errors[questionId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }
  };

  const saveDraft = async (silent = false) => {
    if (!form) {
      console.log('❌ [saveDraft] No form available');
      return;
    }

    console.log('💾 [saveDraft] Starting draft save process:', {
      formId: form.id,
      formTitle: form.title,
      hasCurrentResponse: !!currentResponse,
      currentResponseId: currentResponse?.id,
      silent,
      responsesCount: Object.keys(responses).length,
      conditionalResponsesCount: Object.keys(conditionalResponses).length
    });

    setIsSaving(true);
    try {
      // Merge responses and conditional responses like the web version does
      const allResponses = { ...responses, ...conditionalResponses };
      const isComplete = validateAllQuestions();

      console.log('📋 [saveDraft] Response data prepared:', {
        allResponsesKeys: Object.keys(allResponses),
        allResponsesCount: Object.keys(allResponses).length,
        isComplete,
        currentSectionIndex,
        sampleResponses: Object.entries(allResponses).slice(0, 3).reduce((acc, [key, value]) => {
          acc[key] = typeof value === 'object' ? JSON.stringify(value).substring(0, 100) : value;
          return acc;
        }, {} as Record<string, any>)
      });

      const responseData = {
        formTitle: form.title,
        data: allResponses, // Store merged data instead of separate fields
        conditionalData: conditionalResponses, // Keep for backward compatibility if needed
        isComplete,
        status: 'draft' as const,
        currentSectionIndex,
        sectionInstanceCounts, // Store repeatable section instance counts
        lastUpdatedAt: Date.now(),
      };

      console.log('🔄 [saveDraft] Response data structure:', {
        formTitle: responseData.formTitle,
        dataKeys: Object.keys(responseData.data),
        dataCount: Object.keys(responseData.data).length,
        conditionalDataKeys: Object.keys(responseData.conditionalData || {}),
        isComplete: responseData.isComplete,
        status: responseData.status
      });

      if (currentResponse) {
        console.log('📝 [saveDraft] Updating existing response:', currentResponse.id);
        await updateResponse(currentResponse.id, responseData);
        console.log('✅ [saveDraft] Successfully updated existing response');
      } else {
        console.log('➕ [saveDraft] Creating new response with merged data');
        // Pass merged responses to createResponse
        const newResponse = await createResponse(form.id, allResponses, 'draft');
        console.log('✅ [saveDraft] Created new response:', {
          id: newResponse.id,
          formId: newResponse.formId,
          dataKeys: Object.keys(newResponse.data || {}),
          status: newResponse.status
        });
        
        // Update with full data
        console.log('📝 [saveDraft] Updating new response with full data');
        await updateResponse(newResponse.id, responseData);
        console.log('✅ [saveDraft] Successfully updated new response with full data');
        
        setCurrentResponse(newResponse);
      }

      setHasUnsavedChanges(false);
      console.log('✅ [saveDraft] Draft save completed successfully');
      
      if (!silent) {
        Alert.alert('Success', 'Draft saved successfully');
      }
    } catch (error) {
      console.error('❌ [saveDraft] Error saving draft:', error);
      console.error('[saveDraft] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        formId: form?.id,
        responseId: currentResponse?.id
      });
      
      if (!silent) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        Alert.alert('Error', `Failed to save draft: ${errorMessage}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!form || !currentResponse) {
      console.log('❌ [handleSubmit] No form or response available');
      return;
    }

    if (!isConnected) {
      Alert.alert('No Connection', 'Please check your internet connection and try again.');
      return;
    }

    console.log('📤 [handleSubmit] Starting submission process:', {
      formId: form.id,
      responseId: currentResponse.id,
      responseStatus: currentResponse.status
    });

    // Validate all questions first
    const validationErrors = validateAllQuestions();
    if (Object.keys(validationErrors).length > 0) {
      console.log('❌ [handleSubmit] Validation failed:', {
        errorCount: Object.keys(validationErrors).length,
        errors: validationErrors
      });
      setErrors(validationErrors);
      Alert.alert('Validation Error', 'Please fix all errors before submitting.');
      return;
    }

    setIsSaving(true);
    try {
      // First, save any changes to the response
      const repeatableSections = form.sections.filter(section => 
        (section as any).conditional?.repeatable
      );

      const allResponses = { ...responses, ...conditionalResponses };
      const responseData = {
        formTitle: form.title,
        data: allResponses,
        conditionalData: conditionalResponses,
        isComplete: true,
        currentSectionIndex,
        sectionInstanceCounts: repeatableSections.length > 0 ? sectionInstanceCounts : undefined,
        lastUpdatedAt: Date.now(),
      };

      console.log('💾 [handleSubmit] Saving response changes before sync');
      await updateResponse(currentResponse.id, responseData);

      // Then sync the response
      console.log('🔄 [handleSubmit] Syncing response to server');
      await syncAll();

      // Refresh responses to update the UI
      await refreshResponses();

      console.log('✅ [handleSubmit] Submission completed successfully');
      Alert.alert('Success', 'Form submitted successfully!');
      router.back();
    } catch (error) {
      console.error('❌ [handleSubmit] Error submitting form:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Submission Failed', errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const markAsReadyToSend = async () => {
    if (!form) {
      console.log('❌ [markAsReadyToSend] No form available');
      return;
    }

    console.log('📤 [markAsReadyToSend] Starting ready-to-send process:', {
      formId: form.id,
      formTitle: form.title,
      hasCurrentResponse: !!currentResponse,
      currentResponseId: currentResponse?.id,
      responsesCount: Object.keys(responses).length,
      conditionalResponsesCount: Object.keys(conditionalResponses).length
    });

    // Validate all questions first
    const validationErrors = validateAllQuestions();
    if (Object.keys(validationErrors).length > 0) {
      console.log('❌ [markAsReadyToSend] Validation failed:', {
        errorCount: Object.keys(validationErrors).length,
        errors: validationErrors
      });
      setErrors(validationErrors);
      Alert.alert('Validation Error', 'Please fix all errors before marking as ready to send.');
      return;
    }

    setIsSaving(true);
    try {
      // Process repeatable sections to create multiple responses
      const repeatableSections = form.sections.filter(section => 
        (section as any).conditional?.repeatable
      );

      console.log('🔄 [markAsReadyToSend] Processing repeatable sections:', {
        formId: form.id,
        sectionInstanceCounts,
        repeatableSectionsCount: repeatableSections.length,
        rawResponses: Object.keys(responses).length
      });

      if (repeatableSections.length === 0) {
        // No repeatable sections - create single response with all data
        const allResponses = { ...responses, ...conditionalResponses };
        const responseData = {
          formTitle: form.title,
          data: allResponses,
          conditionalData: conditionalResponses,
          isComplete: true,
          currentSectionIndex,
          lastUpdatedAt: Date.now(),
        };

        if (currentResponse) {
          console.log('📝 [markAsReadyToSend] Updating existing response:', currentResponse.id);
          await updateResponse(currentResponse.id, responseData);
          await updateResponseStatus(currentResponse.id, 'ready_to_send');
        } else {
          const newResponse = await createResponse(form.id, allResponses, 'ready_to_send');
          await updateResponse(newResponse.id, responseData);
          setCurrentResponse(newResponse);
        }
      } else {
        // Create SINGLE response with all instances stored using instance-scoped IDs
        const allResponses = { ...responses, ...conditionalResponses };
        
        console.log('📊 [markAsReadyToSend] Creating single response with multiple instances:', {
          repeatableSections: repeatableSections.length,
          sectionInstanceCounts,
          allResponseKeys: Object.keys(allResponses),
          repeatableSectionIds: repeatableSections.map(s => s.id)
        });

        const responseData = {
          formTitle: form.title,
          data: allResponses, // Store all instances with instance-scoped IDs in single response
          conditionalData: conditionalResponses, // Keep for backward compatibility
          isComplete: true,
          currentSectionIndex,
          sectionInstanceCounts, // Store instance counts for proper reconstruction
          lastUpdatedAt: Date.now(),
        };

        if (currentResponse) {
          console.log('📝 [markAsReadyToSend] Updating existing response with all instances:', currentResponse.id);
          await updateResponse(currentResponse.id, responseData);
          await updateResponseStatus(currentResponse.id, 'ready_to_send');
        } else {
          console.log('➕ [markAsReadyToSend] Creating new response with all instances');
          const newResponse = await createResponse(form.id, allResponses, 'ready_to_send');
          await updateResponse(newResponse.id, responseData);
          setCurrentResponse(newResponse);
        }

        console.log('✅ [markAsReadyToSend] Created single response with all repeatable section instances');
      }

      console.log('✅ [markAsReadyToSend] Ready-to-send process completed successfully');
      Alert.alert('Success', 'Form marked as ready to send. It will be submitted when you are online.');
      router.back();
    } catch (error) {
      console.error('❌ [markAsReadyToSend] Error marking as ready to send:', error);
      console.error('[markAsReadyToSend] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        formId: form?.id,
        responseId: currentResponse?.id
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Error', `Failed to mark as ready to send: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  const validateAllQuestions = (): Record<string, string> => {
    if (!form) return {};

    const validationErrors: Record<string, string> = {};
    const allQuestions = form.sections.flatMap(section => section.questions);

    // Validate each section, handling repeatable sections
    form.sections.forEach(section => {
      const isRepeatable = (section as any)?.conditional?.repeatable === true;
      const instanceCount = getSectionInstanceCount(section.id);
      const mainQuestions = filterMainQuestions(section.questions);

      // Validate each instance of the section
      for (let instanceIndex = 0; instanceIndex < instanceCount; instanceIndex++) {
        mainQuestions.forEach(question => {
          const questionId = isRepeatable ? getInstanceScopedQuestionId(question.id, instanceIndex) : question.id;
          const value = responses[questionId];
          const error = validateQuestion(question, value);
          if (error) {
            validationErrors[questionId] = error;
          }

          // Validate conditional questions within choice options
          if ((question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') && (question as any).options) {
            const selectedValues = value;
            const selectedOptions = Array.isArray(selectedValues) ? selectedValues : [selectedValues];
            
            (question as any).options.forEach((option: any) => {
              if (option.conditionalQuestions && option.conditionalQuestions.length > 0) {
                const isOptionSelected = selectedOptions.includes(option.value);
                
                if (isOptionSelected) {
                  option.conditionalQuestions.forEach((conditionalQuestion: any) => {
                    if (conditionalQuestion.isRequired) {
                      const conditionalQuestionId = isRepeatable ? 
                        getInstanceScopedQuestionId(conditionalQuestion.id, instanceIndex) : 
                        conditionalQuestion.id;
                      const conditionalResponse = conditionalResponses[conditionalQuestionId];
                      
                      if (conditionalResponse === undefined || conditionalResponse === '' || conditionalResponse === null ||
                          (Array.isArray(conditionalResponse) && conditionalResponse.length === 0)) {
                        validationErrors[conditionalQuestionId] = `${conditionalQuestion.title} is required`;
                      }
                    }
                  });
                }
              }
            });
          }
        });
      }
    });

    return validationErrors;
  };

  const getVisibleSections = (): FormSection[] => {
    if (!form) return [];
    return form.sections.filter((section: FormSection) => {
      // For now, show all sections. Can add conditional section logic later
      return true;
    });
  };

  const getCurrentSection = (): FormSection | null => {
    const visibleSections = getVisibleSections();
    return visibleSections[currentSectionIndex] || null;
  };

  /**
   * Get questions for the current section, including conditional questions that should be shown inline
   * Note: For repeatable sections, this returns questions for a single instance (instance 0)
   * The actual rendering will handle multiple instances
   */
  const getCurrentSectionQuestions = (): FormQuestion[] => {
    const section = getCurrentSection();
    if (!section) return [];

    const allResponses = { ...responses, ...conditionalResponses };
    const questions: FormQuestion[] = [];
    const mainQuestions = filterMainQuestions(section.questions);

    // Add main questions and their conditional questions
    for (const question of mainQuestions) {
      questions.push(question);

      // Check for conditional questions based on selected options
      if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') {
        // For repeatable sections, check instance 0
        const isRepeatable = (section as any)?.conditional?.repeatable === true;
        const questionId = isRepeatable ? getInstanceScopedQuestionId(question.id, 0) : question.id;
        const response = responses[questionId];
        if (response) {
          const options = (question as any).options || [];
          const selectedOptions = question.type === 'SINGLE_CHOICE' 
            ? [options.find((opt: any) => opt.value === response)].filter(Boolean)
            : options.filter((opt: any) => Array.isArray(response) && response.includes(opt.value));
          
          for (const option of selectedOptions) {
            if (option?.conditionalQuestions) {
              const condQuestions = getConditionalQuestionsForOption(
                question,
                option.id,
                form?.sections.flatMap(s => s.questions) || []
              );
              questions.push(...condQuestions);
            }
          }
        }
      }
    }

    return questions;
  };

  /**
   * Check if a question is a conditional question that should be shown inline with its parent
   */
  const isInlineConditionalQuestion = (question: FormQuestion): boolean => {
    const allQuestions = form?.sections.flatMap(s => s.questions) || [];
    return allQuestions.some((q: FormQuestion) => {
      if (q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') {
        const options = (q as any).options || [];
        return options.some((opt: any) => 
          opt.conditionalQuestions?.some((cq: any) => cq.id === question.id)
        );
      }
      return false;
    });
  };

  const renderQuestion = (question: FormQuestion, instanceIndex?: number) => {
    const currentSection = getCurrentSection();
    const isRepeatable = currentSection ? (currentSection as any)?.conditional?.repeatable === true : false;
    const questionId = isRepeatable && instanceIndex !== undefined 
      ? getInstanceScopedQuestionId(question.id, instanceIndex) 
      : question.id;
    
    const allResponses = { ...responses, ...conditionalResponses };
    const value = allResponses[questionId];
    const error = errors[questionId];

    // Check if this is a conditional question (show with indentation)
    const isConditional = isInlineConditionalQuestion(question);

    // Check for conditional questions that should appear inline
    let conditionalQuestions: FormQuestion[] = [];
    if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') {
      const response = responses[questionId];
      if (response) {
        const options = (question as any).options || [];
        const selectedOptions = question.type === 'SINGLE_CHOICE' 
          ? [options.find((opt: any) => opt.value === response)].filter(Boolean)
          : options.filter((opt: any) => Array.isArray(response) && response.includes(opt.value));
        
        for (const option of selectedOptions) {
          if (option?.conditionalQuestions) {
            const condQuestions = getConditionalQuestionsForOption(
              question,
              option.id,
              form?.sections.flatMap(s => s.questions) || []
            );
            conditionalQuestions.push(...condQuestions);
          }
        }
      }
    }

    return (
      <View key={questionId}>
        <View className={cn(isConditional && 'ml-4 mt-2 pl-4 border-l-4 border-l-primary')}>
          <QuestionRenderer
            question={question}
            value={value}
            onChange={(val: any) => {
              // Determine if this is a conditional question or main question
              if (isConditional) {
                const conditionalQuestionId = isRepeatable && instanceIndex !== undefined
                  ? getInstanceScopedQuestionId(question.id, instanceIndex)
                  : question.id;
                handleConditionalChange(conditionalQuestionId, val);
              } else {
                handleResponseChange(questionId, val);
              }
            }}
            error={error}
            isPreviewMode={isReadOnly}
            conditionalValues={conditionalResponses}
            onConditionalChange={handleConditionalChange}
            responseId={currentResponse?.id}
          />
        </View>
        
        {/* Render inline conditional questions immediately after their parent */}
        {conditionalQuestions.map((condQuestion: FormQuestion) => {
          const conditionalQuestionId = isRepeatable && instanceIndex !== undefined
            ? getInstanceScopedQuestionId(condQuestion.id, instanceIndex)
            : condQuestion.id;
          return (
            <View key={conditionalQuestionId} className="ml-4 mt-2 pl-4 border-l-4 border-l-primary">
              <QuestionRenderer
                question={condQuestion}
                value={conditionalResponses[conditionalQuestionId]}
                onChange={(val: any) => handleConditionalChange(conditionalQuestionId, val)}
                error={errors[conditionalQuestionId]}
                isPreviewMode={isReadOnly}
                responseId={currentResponse?.id}
              />
            </View>
          );
        })}
      </View>
    );
  };

  const handleNextSection = () => {
    const visibleSections = getVisibleSections();
    if (currentSectionIndex < visibleSections.length - 1) {
      setCurrentSectionIndex(currentSectionIndex + 1);
    }
  };

  const handlePreviousSection = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(currentSectionIndex - 1);
    }
  };

  if (isLoading) {
    return (
      <>
        <View className="flex-1 bg-background" style={{ paddingTop: insets.top }} />
        <LoadingSpinner fullScreen text="Loading form..." visible={isLoading} />
      </>
    );
  }

  if (!form) {
    return (
      <View className="flex-1 bg-background items-center justify-center" style={{ paddingTop: insets.top }}>
        <Text className="text-base text-destructive">Form not found</Text>
      </View>
    );
  }

  const visibleSections = getVisibleSections();
  const currentSection = getCurrentSection();
  const questions = getCurrentSectionQuestions();
  const progress = visibleSections.length > 0 
    ? ((currentSectionIndex + 1) / visibleSections.length) * 100 
    : 0;
  const isFirstSection = currentSectionIndex === 0;
  const isLastSection = currentSectionIndex >= visibleSections.length - 1;

  // Get validation errors for current section
  const getSectionValidationErrors = () => {
    if (!currentSection) return [];
    const validationErrors: Array<{ questionId: string; questionTitle: string; error: string; instanceIndex?: number }> = [];
    const isRepeatable = (currentSection as any)?.conditional?.repeatable === true;
    const instanceCount = getSectionInstanceCount(currentSection.id);
    const mainQuestions = filterMainQuestions(currentSection.questions);

    // Validate each instance of the section
    for (let instanceIndex = 0; instanceIndex < instanceCount; instanceIndex++) {
      mainQuestions.forEach(question => {
        const questionId = isRepeatable ? getInstanceScopedQuestionId(question.id, instanceIndex) : question.id;
        const value = responses[questionId];
        const error = validateQuestion(question, value);
        if (error) {
          validationErrors.push({
            questionId,
            questionTitle: `${question.title}${isRepeatable ? ` (Instance ${instanceIndex + 1})` : ''}`,
            error,
            instanceIndex: isRepeatable ? instanceIndex : undefined
          });
        }

        // Check conditional questions within choice options
        if ((question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') && (question as any).options) {
          const selectedValues = value;
          const selectedOptions = Array.isArray(selectedValues) ? selectedValues : [selectedValues];
          
          (question as any).options.forEach((option: any) => {
            if (option.conditionalQuestions && option.conditionalQuestions.length > 0) {
              const isOptionSelected = selectedOptions.includes(option.value);
              
              if (isOptionSelected) {
                option.conditionalQuestions.forEach((conditionalQuestion: any) => {
                  if (conditionalQuestion.isRequired) {
                    const conditionalQuestionId = isRepeatable ? 
                      getInstanceScopedQuestionId(conditionalQuestion.id, instanceIndex) : 
                      conditionalQuestion.id;
                    const conditionalResponse = conditionalResponses[conditionalQuestionId];
                    
                    if (conditionalResponse === undefined || conditionalResponse === '' || conditionalResponse === null ||
                        (Array.isArray(conditionalResponse) && conditionalResponse.length === 0)) {
                      validationErrors.push({
                        questionId: conditionalQuestionId,
                        questionTitle: `${conditionalQuestion.title}${isRepeatable ? ` (Instance ${instanceIndex + 1})` : ''}`,
                        error: 'This field is required',
                        instanceIndex: isRepeatable ? instanceIndex : undefined
                      });
                    }
                  }
                });
              }
            }
          });
        }
      });
    }

    return validationErrors;
  };

  const validateCurrentSection = () => {
    return getSectionValidationErrors().length === 0;
  };

  const sectionErrors = getSectionValidationErrors();

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <OfflineBanner />
      
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16) + 32 }}>
        {/* Header Card */}
        <Card className="mb-6">
          <CardHeader>
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <CardTitle className="text-2xl font-bold">
                  {form.title}
                </CardTitle>
                {form.description && (
                  <Text className="text-muted-foreground mt-2">{form.description}</Text>
                )}
              </View>
              {isSaving && (
                <View className="w-4 h-4">
                  <LoadingSpinner size="small" />
                </View>
              )}
            </View>
          </CardHeader>
          
          {/* Progress */}
          <CardContent>
            <View className="gap-2">
              <View className="flex-row justify-between">
                <Text className="text-sm text-muted-foreground">Progress</Text>
                <Text className="text-sm text-muted-foreground">
                  {currentSectionIndex + 1} of {visibleSections.length} sections
                </Text>
              </View>
              <Progress value={progress} />
            </View>
          </CardContent>
        </Card>

        {/* Current Section Card */}
        {currentSection && (() => {
          const isRepeatable = (currentSection as any)?.conditional?.repeatable === true;
          const instanceCount = getSectionInstanceCount(currentSection.id);
          const mainQuestions = filterMainQuestions(currentSection.questions);
          
          return (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">
                  {currentSection.title}
                </CardTitle>
                {currentSection.description && (
                  <Text className="text-muted-foreground">{currentSection.description}</Text>
                )}
              </CardHeader>
              <CardContent>
                <View className="gap-6">
                  {/* Render repeatable instances of current section */}
                  {Array.from({ length: instanceCount }).map((_, instanceIndex) => (
                    <View key={`${currentSection.id}-instance-${instanceIndex}`} className="gap-4 border rounded-lg p-4 mb-4">
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-sm text-muted-foreground">Instance {instanceIndex + 1}</Text>
                        {instanceCount > 1 && isRepeatable && (
                          <Button
                            title="Remove"
                            onPress={() => updateSectionInstanceCount(currentSection.id, instanceCount - 1)}
                            variant="outline"
                            className="px-2"
                          />
                        )}
                      </View>
                      {mainQuestions.map(question => renderQuestion(question, instanceIndex))}
                    </View>
                  ))}
                  
                  {/* Add another instance button for repeatable sections */}
                  {isRepeatable && (
                    <Button
                      title={`Add another ${currentSection.title}`}
                      onPress={() => updateSectionInstanceCount(currentSection.id, instanceCount + 1)}
                      variant="outline"
                      className="mt-2"
                    />
                  )}
                </View>
              </CardContent>
            </Card>
          );
        })()}

        {/* Validation Errors */}
        {!validateCurrentSection() && sectionErrors.length > 0 && (
          <Card className="mb-6 border-destructive/20 bg-destructive/5">
            <CardContent className="pt-4">
              <View className="flex-row items-start gap-3">
                <AlertTriangle size={20} color="#DC2626" strokeWidth={2} />
                <View className="flex-1">
                  <Text className="font-medium text-destructive mb-2">
                    Please complete the required fields below:
                  </Text>
                  <View className="gap-1">
                    {sectionErrors.map((error, index) => (
                      <View key={index} className="flex-row items-center gap-2">
                        <View className="w-1.5 h-1.5 bg-destructive rounded-full" />
                        <Text className="text-sm text-destructive/80">
                          <Text className="font-medium">{error.questionTitle}</Text>
                          <Text className="text-destructive/70"> - {error.error}</Text>
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        {!isReadOnly && (
            <View className="flex-row gap-2">
              {!isFirstSection && (
                <Button
                  title="Previous"
                  onPress={handlePreviousSection}
                  variant="outline"
                  className="flex-1"
                />
              )}
              <Button
                title="Save Draft"
                onPress={() => saveDraft(false)}
                variant="outline"
                disabled={isSaving}
                className="flex-1"
              />
              {!isLastSection ? (
                <Button
                  title="Next"
                  onPress={handleNextSection}
                  variant="default"
                  disabled={!validateCurrentSection()}
                  className="flex-1"
                />
              ) : (
                <Button
                  title={currentResponse?.status === 'ready_to_send' ? (isSyncing ? 'Submitting...' : 'Submit') : 'Ready to Send'}
                  onPress={currentResponse?.status === 'ready_to_send' ? handleSubmit : markAsReadyToSend}
                  variant="default"
                  disabled={isSaving || isSyncing || !validateCurrentSection() || (currentResponse?.status === 'ready_to_send' && !isConnected)}
                  loading={isSaving || isSyncing}
                  className="flex-1"
                />
              )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}


