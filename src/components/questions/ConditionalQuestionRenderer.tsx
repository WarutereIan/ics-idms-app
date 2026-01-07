import React from 'react';
import { FormQuestion } from '@/types/forms';

interface ConditionalQuestionRendererProps {
  question: FormQuestion;
  value?: any;
  onChange?: (value: any) => void;
  error?: string;
  isPreviewMode?: boolean;
  conditionalValues?: Record<string, any>;
  onConditionalChange?: (questionId: string, value: any) => void;
  responseId?: string;
}

/**
 * Renders a conditional question by delegating to the main QuestionRenderer.
 * This component exists to break the circular dependency between QuestionRenderer
 * and the choice question renderers (SingleChoiceQuestionRenderer, MultipleChoiceQuestionRenderer).
 */
export function ConditionalQuestionRenderer({
  question,
  value,
  onChange,
  error,
  isPreviewMode = false,
  conditionalValues = {},
  onConditionalChange,
  responseId,
}: ConditionalQuestionRendererProps) {
  // Dynamic import to break circular dependency
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const QuestionRenderer = require('./QuestionRenderer').QuestionRenderer as React.ComponentType<ConditionalQuestionRendererProps>;
  
  return (
    <QuestionRenderer
      question={question}
      value={value}
      onChange={onChange}
      error={error}
      isPreviewMode={isPreviewMode}
      conditionalValues={conditionalValues}
      onConditionalChange={onConditionalChange}
      responseId={responseId}
    />
  );
}


