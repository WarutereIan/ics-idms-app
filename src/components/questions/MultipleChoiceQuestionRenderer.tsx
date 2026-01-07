import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui';
import { Text } from '@/components/ui/text';
import { BaseQuestionRenderer, BaseQuestionRendererProps } from './BaseQuestionRenderer';
import { MultipleChoiceQuestion } from '@/types/forms';
import { ConditionalQuestionRenderer } from './ConditionalQuestionRenderer';
import { cn } from '@/lib/utils';

interface MultipleChoiceQuestionRendererProps extends Omit<BaseQuestionRendererProps, 'children'> {
  question: MultipleChoiceQuestion;
  conditionalValues?: Record<string, any>;
  onConditionalChange?: (questionId: string, value: any) => void;
}

export function MultipleChoiceQuestionRenderer({
  question,
  value = [],
  onChange,
  error,
  isPreviewMode,
  conditionalValues = {},
  onConditionalChange,
}: MultipleChoiceQuestionRendererProps) {
  const [otherText, setOtherText] = useState('');
  const selectedValues = Array.isArray(value) ? value : [];

  // Extract "other" value from the value array if it exists
  const otherValue = selectedValues.find(v => typeof v === 'string' && v.startsWith('other:'));
  const otherValueText = otherValue ? (otherValue as string).replace('other:', '') : '';
  
  // Initialize otherText if we have a value
  useEffect(() => {
    if (otherValueText && !otherText) {
      setOtherText(otherValueText);
    }
  }, [otherValueText, otherText]);

  const handleOptionChange = (optionValue: string, checked: boolean) => {
    if (!onChange) return;

    let newValue = [...selectedValues];
    
    if (checked) {
      // Check if we're at the maximum limit
      if (question.maxSelections && newValue.length >= question.maxSelections) {
        return;
      }
      
      // Add the option if it's not already selected
      if (!newValue.includes(optionValue)) {
        newValue.push(optionValue);
      }
    } else {
      // Remove the option
      newValue = newValue.filter(v => v !== optionValue);
    }

    onChange(newValue);
  };

  const handleOtherToggle = (checked: boolean) => {
    if (!onChange) return;

    let newValue = [...selectedValues];
    
    if (checked) {
      // Check if we're at the maximum limit
      if (question.maxSelections && newValue.length >= question.maxSelections) {
        return;
      }
      
      // Add "other" option
      const otherOption = otherText ? `other:${otherText}` : 'other:';
      if (!newValue.includes(otherOption)) {
        newValue.push(otherOption);
      }
    } else {
      // Remove "other" option
      newValue = newValue.filter(v => !(typeof v === 'string' && v.startsWith('other:')));
      setOtherText('');
    }

    onChange(newValue);
  };

  const handleOtherTextChange = (text: string) => {
    setOtherText(text);
    
    if (!onChange) return;

    // Update the "other" value in the array
    let newValue = [...selectedValues];
    const otherIndex = newValue.findIndex(v => typeof v === 'string' && v.startsWith('other:'));
    
    if (otherIndex !== -1) {
      newValue[otherIndex] = `other:${text}`;
      onChange(newValue);
    }
  };

  const isOtherSelected = selectedValues.some(v => typeof v === 'string' && v.startsWith('other:'));

  return (
    <BaseQuestionRenderer question={question} error={error} isPreviewMode={isPreviewMode}>
      <View className="gap-3">
        {question.options?.map((option) => {
          const isSelected = selectedValues.includes(option.value.toString());
          const isDisabled = !!(
            question.maxSelections && 
            !isSelected && 
            selectedValues.length >= question.maxSelections
          );
          
          return (
            <View key={option.id} className="gap-2">
              <View className="flex-row items-center gap-2">
                <Checkbox
                  checked={isSelected}
                  onPress={() => handleOptionChange(option.value.toString(), !isSelected)}
                  disabled={isDisabled || isPreviewMode}
                  className={cn(isPreviewMode && 'opacity-50')}
                />
                <Text
                  className={cn(
                    'text-sm flex-1',
                    isPreviewMode ? 'text-emerald-700' : 'text-foreground',
                    isDisabled && 'text-muted-foreground'
                  )}
                  onPress={() => !isPreviewMode && !isDisabled && handleOptionChange(option.value.toString(), !isSelected)}
                >
                  {option.label}
                </Text>
              </View>
              
              {/* Conditional Questions */}
              {option.conditionalQuestions && 
               option.conditionalQuestions.length > 0 && 
               isSelected && (
                <View className="ml-6 mt-3 p-4 border-l-4 border-l-emerald-500 bg-emerald-50 rounded-r-lg">
                  <Text className="text-sm font-medium text-emerald-700 mb-3">
                    Additional questions for "{option.label}":
                  </Text>
                  <View className="gap-4">
                    {option.conditionalQuestions.map((conditionalQuestion) => (
                      <ConditionalQuestionRenderer
                        key={conditionalQuestion.id}
                        question={conditionalQuestion}
                        value={conditionalValues[conditionalQuestion.id]}
                        onChange={(value: any) => {
                          onConditionalChange?.(conditionalQuestion.id, value);
                        }}
                        error={undefined}
                        isPreviewMode={isPreviewMode}
                        conditionalValues={conditionalValues}
                        onConditionalChange={onConditionalChange}
                      />
                    ))}
                  </View>
                </View>
              )}
            </View>
          );
        })}
        
        {/* Other option */}
        {(question as any).allowOther && (
          <View className="flex-row items-center gap-2">
            <Checkbox
              checked={isOtherSelected}
              onPress={() => handleOtherToggle(!isOtherSelected)}
              disabled={isPreviewMode}
            />
            <Text
              className={cn(
                'text-sm',
                isPreviewMode ? 'text-emerald-700' : 'text-foreground'
              )}
              onPress={() => !isPreviewMode && handleOtherToggle(!isOtherSelected)}
            >
              Other:
            </Text>
            <Input 
              placeholder="Please specify..." 
              className="flex-1" 
              value={isOtherSelected ? otherText : ''}
              onChangeText={handleOtherTextChange}
              editable={!isPreviewMode && isOtherSelected}
            />
          </View>
        )}
        
        {(question.minSelections || question.maxSelections) && (
          <Text className="text-xs text-muted-foreground mt-2">
            {question.minSelections && question.maxSelections
              ? `Select ${question.minSelections}-${question.maxSelections} option${question.maxSelections !== 1 ? 's' : ''}`
              : question.minSelections
              ? `Select at least ${question.minSelections} option${question.minSelections !== 1 ? 's' : ''}`
              : question.maxSelections
              ? `Select up to ${question.maxSelections} option${question.maxSelections !== 1 ? 's' : ''}`
              : ''
            }
          </Text>
        )}
      </View>
    </BaseQuestionRenderer>
  );
}
