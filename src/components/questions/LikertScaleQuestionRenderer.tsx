import React from 'react';
import { View } from 'react-native';
import { RadioButton } from '@/components/ui/RadioButton';
import { Text } from '@/components/ui/text';

import { BaseQuestionRenderer, BaseQuestionRendererProps } from './BaseQuestionRenderer';
import { LikertScaleQuestion } from '@/types/forms';
import { cn } from '@/lib/utils';

interface LikertScaleQuestionRendererProps extends Omit<BaseQuestionRendererProps, 'children'> {
  question: LikertScaleQuestion;
}

export function LikertScaleQuestionRenderer({
  question,
  value,
  onChange,
  error,
  isPreviewMode,
}: LikertScaleQuestionRendererProps) {
  const scale = question.scale || 5; // Default to 5-point scale
  const labels = question.labels || {};
  
  // Generate scale options
  const scaleOptions = Array.from({ length: scale }, (_, i) => i + 1);

  const getLabel = (scaleValue: number): string => {
    if (labels[scaleValue]) {
      return labels[scaleValue];
    }
    // Default labels if not provided
    if (scale === 5) {
      const defaults: Record<number, string> = {
        1: 'Strongly Disagree',
        2: 'Disagree',
        3: 'Neutral',
        4: 'Agree',
        5: 'Strongly Agree',
      };
      return defaults[scaleValue] || scaleValue.toString();
    }
    return scaleValue.toString();
  };

  return (
    <BaseQuestionRenderer
      question={question}
      error={error}
      isPreviewMode={isPreviewMode}
    >
      <View className="gap-4">
        <View className="flex-row justify-between flex-wrap gap-2">
          {scaleOptions.map((scaleValue) => {
            const isSelected = value === scaleValue;
            return (
              <View
                key={scaleValue}
                className={cn(
                  'flex-1 min-w-[60px] items-center p-3 rounded-lg border-2',
                  isSelected ? 'border-primary bg-emerald-50' : 'border-gray-300 bg-white'
                )}
              >
                <RadioButton
                  checked={isSelected}
                  onPress={() => onChange?.(scaleValue)}
                  disabled={isPreviewMode}
                  className="mb-2"
                />
                <Text className={cn(
                  'text-lg font-semibold mb-1',
                  isSelected ? 'text-primary' : 'text-foreground'
                )}>
                  {scaleValue}
                </Text>
                <Text
                  className={cn(
                    'text-xs text-center',
                    isSelected ? 'text-primary font-semibold' : 'text-muted-foreground'
                  )}
                  numberOfLines={2}
                >
                  {getLabel(scaleValue)}
                </Text>
              </View>
            );
          })}
        </View>
        {question.showLabels && (
          <View className="flex-row justify-between mt-3">
            {question.leftLabel && (
              <Text className="text-xs text-muted-foreground italic">{question.leftLabel}</Text>
            )}
            {question.rightLabel && (
              <Text className="text-xs text-muted-foreground italic">{question.rightLabel}</Text>
            )}
          </View>
        )}
      </View>
    </BaseQuestionRenderer>
  );
}
