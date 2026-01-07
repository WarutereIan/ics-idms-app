import React from 'react';
import { Input } from '@/components/ui';
import { BaseQuestionRenderer, BaseQuestionRendererProps } from './BaseQuestionRenderer';
import { ShortTextQuestion } from '@/types/forms';
import { cn } from '@/lib/utils';

interface ShortTextQuestionRendererProps extends Omit<BaseQuestionRendererProps, 'children'> {
  question: ShortTextQuestion;
}

export function ShortTextQuestionRenderer({
  question,
  value = '',
  onChange,
  error,
  isPreviewMode,
}: ShortTextQuestionRendererProps) {
  return (
    <BaseQuestionRenderer
      question={question}
      error={error}
      isPreviewMode={isPreviewMode}
    >
      <Input
        value={value}
        onChangeText={onChange}
        placeholder={question.placeholder || 'Enter text...'}
        maxLength={question.maxLength}
        editable={!isPreviewMode}
        autoCapitalize="sentences"
        className={cn(
          isPreviewMode && 'bg-emerald-50 border-emerald-200',
          error && 'border-destructive'
        )}
      />
    </BaseQuestionRenderer>
  );
}

