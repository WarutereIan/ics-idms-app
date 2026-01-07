import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { cn } from '@/lib/utils';

interface RadioButtonProps {
  checked: boolean;
  onPress: () => void;
  disabled?: boolean;
  className?: string;
}

export function RadioButton({ checked, onPress, disabled, className }: RadioButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      className={cn('items-center justify-center', className)}
    >
      <View
        className={cn(
          'h-4 w-4 rounded-full border-2 items-center justify-center',
          checked ? 'border-primary bg-primary' : 'border-gray-300',
          disabled && 'opacity-50'
        )}
      >
        {checked && (
          <View className="h-2 w-2 rounded-full bg-white" />
        )}
      </View>
    </TouchableOpacity>
  );
}


