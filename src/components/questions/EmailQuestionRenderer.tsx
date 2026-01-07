import React from 'react';
import { Input } from '@/components/ui';
import { BaseQuestionRenderer, BaseQuestionRendererProps } from './BaseQuestionRenderer';
import { EmailQuestion } from '@/types/forms';
import { cn } from '@/lib/utils';

interface EmailQuestionRendererProps extends Omit<BaseQuestionRendererProps, 'children'> {
  question: EmailQuestion;
}

export function EmailQuestionRenderer({
  question,
  value = '',
  onChange,
  error,
  isPreviewMode,
}: EmailQuestionRendererProps) {
  return (
    <BaseQuestionRenderer
      question={question}
      error={error}
      isPreviewMode={isPreviewMode}
    >
      <Input
        value={value}
        onChangeText={onChange}
        placeholder={question.placeholder || 'Enter email address...'}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        editable={!isPreviewMode}
        className={cn(
          isPreviewMode && 'bg-emerald-50 border-emerald-200',
          error && 'border-destructive'
        )}
      />
    </BaseQuestionRenderer>
  );
}

