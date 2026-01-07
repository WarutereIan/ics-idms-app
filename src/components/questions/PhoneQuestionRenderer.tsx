import React from 'react';
import { Input } from '@/components/ui';
import { BaseQuestionRenderer, BaseQuestionRendererProps } from './BaseQuestionRenderer';
import { PhoneQuestion } from '@/types/forms';
import { cn } from '@/lib/utils';

interface PhoneQuestionRendererProps extends Omit<BaseQuestionRendererProps, 'children'> {
  question: PhoneQuestion;
}

export function PhoneQuestionRenderer({
  question,
  value = '',
  onChange,
  error,
  isPreviewMode,
}: PhoneQuestionRendererProps) {
  return (
    <BaseQuestionRenderer
      question={question}
      error={error}
      isPreviewMode={isPreviewMode}
    >
      <Input
        value={value}
        onChangeText={onChange}
        placeholder={question.placeholder || 'Enter phone number...'}
        keyboardType="phone-pad"
        autoComplete="tel"
        editable={!isPreviewMode}
        className={cn(
          isPreviewMode && 'bg-emerald-50 border-emerald-200',
          error && 'border-destructive'
        )}
      />
    </BaseQuestionRenderer>
  );
}

