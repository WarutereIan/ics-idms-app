import React from 'react';
import { View, Text } from 'react-native';
import { FormQuestion } from '@/types/forms';
import { ShortTextQuestionRenderer } from './ShortTextQuestionRenderer';
import { NumberQuestionRenderer } from './NumberQuestionRenderer';
import { SingleChoiceQuestionRenderer } from './SingleChoiceQuestionRenderer';
import { MultipleChoiceQuestionRenderer } from './MultipleChoiceQuestionRenderer';
import { DateQuestionRenderer } from './DateQuestionRenderer';
import { EmailQuestionRenderer } from './EmailQuestionRenderer';
import { PhoneQuestionRenderer } from './PhoneQuestionRenderer';
import { LikertScaleQuestionRenderer } from './LikertScaleQuestionRenderer';
import { SliderQuestionRenderer } from './SliderQuestionRenderer';
import { LocationQuestionRenderer } from './LocationQuestionRenderer';
import { MediaUploadQuestionRenderer } from './MediaUploadQuestionRenderer';

interface QuestionRendererProps {
  question: FormQuestion;
  value?: any;
  onChange?: (value: any) => void;
  error?: string;
  isPreviewMode?: boolean;
  conditionalValues?: Record<string, any>;
  onConditionalChange?: (questionId: string, value: any) => void;
  responseId?: string; // For media attachments
}

export function QuestionRenderer({
  question,
  value,
  onChange,
  error,
  isPreviewMode = false,
  conditionalValues = {},
  onConditionalChange,
  responseId,
}: QuestionRendererProps) {
  switch (question.type) {
    case 'SHORT_TEXT':
    case 'LONG_TEXT':
      return (
        <ShortTextQuestionRenderer
          question={question as any}
          value={value}
          onChange={onChange}
          error={error}
          isPreviewMode={isPreviewMode}
        />
      );

    case 'NUMBER':
      return (
        <NumberQuestionRenderer
          question={question as any}
          value={value}
          onChange={onChange}
          error={error}
          isPreviewMode={isPreviewMode}
        />
      );

    case 'SINGLE_CHOICE':
      return (
        <SingleChoiceQuestionRenderer
          question={question as any}
          value={value}
          onChange={onChange}
          error={error}
          isPreviewMode={isPreviewMode}
          conditionalValues={conditionalValues}
          onConditionalChange={onConditionalChange}
        />
      );

    case 'MULTIPLE_CHOICE':
      return (
        <MultipleChoiceQuestionRenderer
          question={question as any}
          value={value}
          onChange={onChange}
          error={error}
          isPreviewMode={isPreviewMode}
          conditionalValues={conditionalValues}
          onConditionalChange={onConditionalChange}
        />
      );

    case 'DATE':
      return (
        <DateQuestionRenderer
          question={question as any}
          value={value}
          onChange={onChange}
          error={error}
          isPreviewMode={isPreviewMode}
        />
      );

    case 'EMAIL':
      return (
        <EmailQuestionRenderer
          question={question as any}
          value={value}
          onChange={onChange}
          error={error}
          isPreviewMode={isPreviewMode}
        />
      );

    case 'PHONE':
      return (
        <PhoneQuestionRenderer
          question={question as any}
          value={value}
          onChange={onChange}
          error={error}
          isPreviewMode={isPreviewMode}
        />
      );

    case 'LIKERT_SCALE':
      return (
        <LikertScaleQuestionRenderer
          question={question as any}
          value={value}
          onChange={onChange}
          error={error}
          isPreviewMode={isPreviewMode}
        />
      );

    case 'SLIDER':
      return (
        <SliderQuestionRenderer
          question={question as any}
          value={value}
          onChange={onChange}
          error={error}
          isPreviewMode={isPreviewMode}
        />
      );

    case 'LOCATION':
      return (
        <LocationQuestionRenderer
          question={question as any}
          value={value}
          onChange={onChange}
          error={error}
          isPreviewMode={isPreviewMode}
        />
      );

    case 'IMAGE_UPLOAD':
    case 'VIDEO_UPLOAD':
    case 'AUDIO_UPLOAD':
    case 'FILE_UPLOAD':
      return (
        <MediaUploadQuestionRenderer
          question={question as any}
          value={value}
          onChange={onChange}
          error={error}
          isPreviewMode={isPreviewMode}
          responseId={responseId}
        />
      );

    default:
      return (
        <View style={{ padding: 16, backgroundColor: '#fee2e2', borderRadius: 8 }}>
          <Text style={{ color: '#991b1b', fontWeight: '600' }}>
            Unsupported Question Type
          </Text>
          <Text style={{ color: '#991b1b', fontSize: 12, marginTop: 4 }}>
            Question type "{(question as any).type}" is not yet supported.
          </Text>
        </View>
      );
  }
}

