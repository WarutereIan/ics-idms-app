import React from 'react';
import { KeyboardTypeOptions } from 'react-native';
import { Input } from '@/components/ui';
import { BaseQuestionRenderer, BaseQuestionRendererProps } from './BaseQuestionRenderer';
import { NumberQuestion } from '@/types/forms';
import { cn } from '@/lib/utils';

interface NumberQuestionRendererProps extends Omit<BaseQuestionRendererProps, 'children'> {
  question: NumberQuestion;
}

export function NumberQuestionRenderer({
  question,
  value = '',
  onChange,
  error,
  isPreviewMode,
}: NumberQuestionRendererProps) {
  const handleChange = (text: string) => {
    // Allow empty string or valid number
    if (text === '') {
      onChange?.('');
      return;
    }

    // Remove non-numeric characters except decimal point
    const numericText = text.replace(/[^0-9.-]/g, '');
    
    // Validate min/max if provided
    const numValue = parseFloat(numericText);
    if (!isNaN(numValue)) {
      if (question.min !== undefined && numValue < question.min) {
        return; // Don't update if below min
      }
      if (question.max !== undefined && numValue > question.max) {
        return; // Don't update if above max
      }
    }

    onChange?.(numericText);
  };

  const keyboardType: KeyboardTypeOptions = question.step !== undefined && question.step < 1
    ? 'decimal-pad'
    : 'numeric';

  return (
    <BaseQuestionRenderer
      question={question}
      error={error}
      isPreviewMode={isPreviewMode}
    >
      <Input
        value={value?.toString() || ''}
        onChangeText={handleChange}
        placeholder={question.placeholder || 'Enter number...'}
        keyboardType={keyboardType}
        editable={!isPreviewMode}
        className={cn(
          isPreviewMode && 'bg-emerald-50 border-emerald-200',
          error && 'border-destructive'
        )}
      />
    </BaseQuestionRenderer>
  );
}

