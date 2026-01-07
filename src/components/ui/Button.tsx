import React from 'react';
import { ActivityIndicator } from 'react-native';
import { Button as RNReusablesButton } from './button-base';
import { Text } from './text';
import type { ButtonProps as RNReusablesButtonProps } from './button-base';

export interface ButtonWrapperProps extends Omit<RNReusablesButtonProps, 'children'> {
  title: string;
  onPress: () => void;
  loading?: boolean;
}

export function Button({ title, onPress, loading, disabled, variant, className, ...props }: ButtonWrapperProps) {
  return (
    <RNReusablesButton
      onPress={onPress}
      disabled={disabled || loading}
      variant={variant}
      className={className}
      {...props}
    >
      {loading ? (
        <ActivityIndicator 
          size="small" 
          color={variant === 'outline' || variant === 'ghost' ? undefined : 'white'} 
        />
      ) : (
        <Text>{title}</Text>
      )}
    </RNReusablesButton>
  );
}
