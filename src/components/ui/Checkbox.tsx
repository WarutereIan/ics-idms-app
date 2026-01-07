import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Check } from 'lucide-react-native';
import { cn } from '@/lib/utils';

interface CheckboxProps {
  checked: boolean;
  onPress: () => void;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({ checked, onPress, disabled, className }: CheckboxProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      className={cn('items-center justify-center', className)}
    >
      <View
        className={cn(
          'h-5 w-5 rounded-sm border-2 items-center justify-center',
          checked ? 'border-primary bg-primary' : 'border-gray-300 bg-white',
          disabled && 'opacity-50'
        )}
      >
        {checked && (
          <Check size={14} color="#ffffff" strokeWidth={3} />
        )}
      </View>
    </TouchableOpacity>
  );
}


