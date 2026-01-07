import React, { useState } from 'react';
import { View, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button } from '@/components/ui';
import { Text } from '@/components/ui/text';
import { BaseQuestionRenderer, BaseQuestionRendererProps } from './BaseQuestionRenderer';
import { DateQuestion } from '@/types/forms';
import { cn } from '@/lib/utils';

interface DateQuestionRendererProps extends Omit<BaseQuestionRendererProps, 'children'> {
  question: DateQuestion;
}

export function DateQuestionRenderer({
  question,
  value,
  onChange,
  error,
  isPreviewMode,
}: DateQuestionRendererProps) {
  const [showPicker, setShowPicker] = useState(false);

  const dateValue = value ? new Date(value) : new Date();
  const displayValue = value ? new Date(value).toLocaleDateString() : 'Select date...';

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }

    if (selectedDate) {
      const dateString = selectedDate.toISOString().split('T')[0];
      onChange?.(dateString);
    }
  };

  const minDate = question.minDate ? new Date(question.minDate) : undefined;
  const maxDate = question.maxDate ? new Date(question.maxDate) : undefined;

  return (
    <BaseQuestionRenderer
      question={question}
      error={error}
      isPreviewMode={isPreviewMode}
    >
      <View className="gap-2">
        <Button
          variant="outline"
          title={displayValue}
          onPress={() => !isPreviewMode && setShowPicker(true)}
          disabled={isPreviewMode}
          className={cn(
            'w-full justify-between',
            error && 'border-destructive',
            isPreviewMode && 'bg-emerald-50 border-emerald-200'
          )}
        />

        {showPicker && (
          <DateTimePicker
            value={dateValue}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            minimumDate={minDate}
            maximumDate={maxDate}
          />
        )}

        {Platform.OS === 'ios' && showPicker && (
          <Button
            title="Done"
            onPress={() => setShowPicker(false)}
            variant="default"
            className="self-end"
          />
        )}

        {(question.minDate || question.maxDate) && (
          <Text className="text-xs text-muted-foreground">
            {question.minDate && question.maxDate ? (
              `Date must be between ${new Date(question.minDate).toLocaleDateString()} and ${new Date(question.maxDate).toLocaleDateString()}`
            ) : question.minDate ? (
              `Date must be after ${new Date(question.minDate).toLocaleDateString()}`
            ) : question.maxDate ? (
              `Date must be before ${new Date(question.maxDate).toLocaleDateString()}`
            ) : null}
          </Text>
        )}
      </View>
    </BaseQuestionRenderer>
  );
}
