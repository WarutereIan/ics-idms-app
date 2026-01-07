import React, { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { FormQuestion } from '@/types/forms';

export interface BaseQuestionRendererProps {
  question: FormQuestion;
  value?: any;
  onChange?: (value: any) => void;
  error?: string;
  isPreviewMode?: boolean;
  children: ReactNode;
}

export function BaseQuestionRenderer({
  question,
  children,
  error,
  isPreviewMode,
}: BaseQuestionRendererProps) {
  return (
    <View className="mb-6">
      {/* Question Title and Description */}
      <View className="mb-3">
        <Text className="text-base font-medium">
          {question.title}
          {question.isRequired && <Text className="text-destructive ml-1">*</Text>}
        </Text>
        {question.description && (
          <Text className="text-sm text-muted-foreground mt-1">{question.description}</Text>
        )}
      </View>

      {/* Question Input */}
      <View className="mt-2">
        {children}
      </View>

      {/* Error Message */}
      {error && (
        <Text className="text-sm text-destructive mt-2">{error}</Text>
      )}

      {/* Preview Mode Indicator */}
      {isPreviewMode && (
        <Text className="text-xs text-primary italic mt-2">
          Preview mode - responses will not be submitted
        </Text>
      )}
    </View>
  );
}

