import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { RadioButton } from '@/components/ui/RadioButton';
import { Input } from '@/components/ui';
import { Text } from '@/components/ui/text';
import { BaseQuestionRenderer, BaseQuestionRendererProps } from './BaseQuestionRenderer';
import { SingleChoiceQuestion } from '@/types/forms';
import { ConditionalQuestionRenderer } from './ConditionalQuestionRenderer';
import { cn } from '@/lib/utils';

interface SingleChoiceQuestionRendererProps extends Omit<BaseQuestionRendererProps, 'children'> {
  question: SingleChoiceQuestion;
  conditionalValues?: Record<string, any>;
  onConditionalChange?: (questionId: string, value: any) => void;
}

export function SingleChoiceQuestionRenderer({
  question,
  value,
  onChange,
  error,
  isPreviewMode,
  conditionalValues = {},
  onConditionalChange,
}: SingleChoiceQuestionRendererProps) {
  const [otherText, setOtherText] = useState('');

  // Extract "other" text from value if it exists
  const isOtherSelected = value === 'other' || (typeof value === 'string' && value.startsWith('other:'));
  const currentOtherText = typeof value === 'string' && value.startsWith('other:') ? value.replace('other:', '') : '';
  
  // Initialize otherText if we have a value
  useEffect(() => {
    if (currentOtherText && !otherText) {
      setOtherText(currentOtherText);
    }
  }, [currentOtherText, otherText]);

  const handleOtherTextChange = (text: string) => {
    setOtherText(text);
    
    if (!onChange) return;

    // Update the value to include the other text
    const newValue = text ? `other:${text}` : 'other';
    onChange(newValue);
  };

  const handleOptionSelect = (optionValue: string, optionId: string) => {
    onChange?.(optionValue);

    // Handle conditional questions
    const option = question.options.find(opt => opt.id === optionId);
    if (option?.conditionalQuestions && onConditionalChange) {
      // Clear previous conditional question values
      option.conditionalQuestions.forEach((condQuestion) => {
        onConditionalChange(condQuestion.id, undefined);
      });
    }
  };

  return (
    <BaseQuestionRenderer
      question={question}
      error={error}
      isPreviewMode={isPreviewMode}
    >
      <View className="gap-3">
        {question.options && question.options.length > 0 ? (
          question.options.map((option) => {
            const isSelected = value === option.value.toString();
            const selectedOption = question.options?.find(opt => opt.value.toString() === value);
            
            return (
              <View key={option.id} className="gap-2">
                <View className="flex-row items-center gap-2">
                  <RadioButton
                    checked={isSelected}
                    onPress={() => handleOptionSelect(option.value.toString(), option.id)}
                    disabled={isPreviewMode}
                    className={cn(isPreviewMode && 'opacity-50')}
                  />
                  <Text
                    className={cn(
                      'text-sm flex-1',
                      isPreviewMode ? 'text-emerald-700' : 'text-foreground'
                    )}
                    onPress={() => !isPreviewMode && handleOptionSelect(option.value.toString(), option.id)}
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
          })
        ) : (
          <Text className="text-sm text-muted-foreground italic">
            No options available for this question.
          </Text>
        )}
        
        {/* Other option */}
        {(question as any).allowOther && (
          <View className="flex-row items-center gap-2">
            <RadioButton
              checked={isOtherSelected}
              onPress={() => onChange?.('other')}
              disabled={isPreviewMode}
            />
            <Text
              className={cn(
                'text-sm',
                isPreviewMode ? 'text-emerald-700' : 'text-foreground'
              )}
              onPress={() => !isPreviewMode && onChange?.('other')}
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
      </View>
    </BaseQuestionRenderer>
  );
}
