import React from 'react';
import { View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Text } from '@/components/ui/text';
import { BaseQuestionRenderer, BaseQuestionRendererProps } from './BaseQuestionRenderer';
import { SliderQuestion } from '@/types/forms';
import { cn } from '@/lib/utils';

interface SliderQuestionRendererProps extends Omit<BaseQuestionRendererProps, 'children'> {
  question: SliderQuestion;
}

export function SliderQuestionRenderer({
  question,
  value,
  onChange,
  error,
  isPreviewMode,
}: SliderQuestionRendererProps) {
  const min = question.min || 0;
  const max = question.max || 100;
  const step = question.step || 1;
  const currentValue = value !== undefined && value !== null ? Number(value) : min;

  const handleValueChange = (newValue: number) => {
    onChange?.(newValue);
  };

  const displayValue = `${question.prefix || ''}${currentValue}${question.suffix || ''}`;

  return (
    <BaseQuestionRenderer
      question={question}
      error={error}
      isPreviewMode={isPreviewMode}
    >
      <View className="gap-4">
        {/* Current Value Display */}
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-medium">Current value:</Text>
          <Text className="text-lg font-bold">{displayValue}</Text>
        </View>

        {/* Slider */}
        <View className="px-2">
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={min}
            maximumValue={max}
            step={step}
            value={currentValue}
            onValueChange={handleValueChange}
            disabled={isPreviewMode}
            minimumTrackTintColor="#10B981"
            maximumTrackTintColor="#d1d5db"
            thumbTintColor="#10B981"
          />
        </View>

        {/* Min/Max Labels */}
        <View className="flex-row justify-between">
          <Text className="text-xs text-muted-foreground">
            {question.prefix || ''}{min}{question.suffix || ''}
          </Text>
          {question.leftLabel && (
            <Text className="text-xs text-muted-foreground italic flex-1 text-center">
              {question.leftLabel}
            </Text>
          )}
          {question.midLabel && (
            <Text className="text-xs text-muted-foreground italic">
              {question.midLabel}
            </Text>
          )}
          {question.rightLabel && (
            <Text className="text-xs text-muted-foreground italic flex-1 text-center">
              {question.rightLabel}
            </Text>
          )}
          <Text className="text-xs text-muted-foreground">
            {question.prefix || ''}{max}{question.suffix || ''}
          </Text>
        </View>

        {/* Show Value Option */}
        {question.showValue && (
          <View className="bg-gray-50 py-2 rounded-lg">
            <Text className="text-center text-sm font-medium">
              Selected: {displayValue}
            </Text>
          </View>
        )}
      </View>
    </BaseQuestionRenderer>
  );
}
