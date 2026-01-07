import { FormQuestion, SingleChoiceQuestion, MultipleChoiceQuestion } from '@/types/forms';

/**
 * Helper function to identify if a question is a conditional question
 * Conditional questions are those that appear in option.conditionalQuestions
 * or are marked with isConditional flag in their config
 */
export function isConditionalQuestion(question: FormQuestion, allQuestions: FormQuestion[]): boolean {
  // First check if the question has isConditional flag in config
  if ((question as any).config?.isConditional || (question as any).isConditional) {
    return true;
  }
  
  // Fallback: Check if this question appears in any option's conditionalQuestions
  for (const otherQuestion of allQuestions) {
    // Only choice questions have options
    if (otherQuestion.type === 'SINGLE_CHOICE' || otherQuestion.type === 'MULTIPLE_CHOICE') {
      const choiceQuestion = otherQuestion as SingleChoiceQuestion | MultipleChoiceQuestion;
      
      // Check options
      const options = choiceQuestion.options || [];
      
      for (const option of options) {
        if (option.conditionalQuestions) {
          const isInConditionalQuestions = option.conditionalQuestions.some(
            (condQuestion: any) => condQuestion.id === question.id
          );
          if (isInConditionalQuestions) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Filter out conditional questions from the main question list
 * Conditional questions should only be rendered when their parent option is selected
 */
export function filterMainQuestions(questions: FormQuestion[]): FormQuestion[] {
  return questions.filter(question => !isConditionalQuestion(question, questions));
}

/**
 * Get all conditional questions for a specific parent question and option
 */
export function getConditionalQuestionsForOption(
  parentQuestion: FormQuestion, 
  optionId: string, 
  allQuestions: FormQuestion[]
): FormQuestion[] {
  // Only choice questions have options
  if (parentQuestion.type !== 'SINGLE_CHOICE' && parentQuestion.type !== 'MULTIPLE_CHOICE') {
    return [];
  }

  const choiceQuestion = parentQuestion as SingleChoiceQuestion | MultipleChoiceQuestion;
  const options = choiceQuestion.options || [];
  const option = options.find((opt: any) => opt.id === optionId);
  
  if (!option || !option.conditionalQuestions) {
    return [];
  }

  // Find the actual question objects from the allQuestions list
  return option.conditionalQuestions
    .map((condQuestion: any) => allQuestions.find((q: FormQuestion) => q.id === condQuestion.id))
    .filter((q): q is FormQuestion => q !== undefined);
}

/**
 * Validate a question response
 */
export function validateQuestion(question: FormQuestion, value: any): string | null {
  // Required validation
  if (question.isRequired) {
    if (value === undefined || value === null || value === '') {
      return 'This field is required';
    }
    if (Array.isArray(value) && value.length === 0) {
      return 'This field is required';
    }
  }

  // Type-specific validations
  if (question.type === 'NUMBER') {
    const numQuestion = question as any;
    if (value !== '' && value !== null && value !== undefined) {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        return 'Please enter a valid number';
      }
      if (numQuestion.min !== undefined && numValue < numQuestion.min) {
        return `Value must be at least ${numQuestion.min}`;
      }
      if (numQuestion.max !== undefined && numValue > numQuestion.max) {
        return `Value must be at most ${numQuestion.max}`;
      }
    }
  }

  if (question.type === 'MULTIPLE_CHOICE') {
    const multiQuestion = question as any;
    const selectedCount = Array.isArray(value) ? value.length : 0;
    
    if (multiQuestion.minSelections && selectedCount < multiQuestion.minSelections) {
      return `Please select at least ${multiQuestion.minSelections} option${multiQuestion.minSelections > 1 ? 's' : ''}`;
    }
    if (multiQuestion.maxSelections && selectedCount > multiQuestion.maxSelections) {
      return `Please select at most ${multiQuestion.maxSelections} option${multiQuestion.maxSelections > 1 ? 's' : ''}`;
    }
  }

  return null;
}

