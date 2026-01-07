import React from 'react';
import { View } from 'react-native';
import { cn } from '@/lib/utils';

interface ProgressProps {
  value: number; // 0-100
  className?: string;
}

export function Progress({ value, className }: ProgressProps) {
  const percentage = Math.min(Math.max(value, 0), 100);
  
  return (
    <View className={cn('h-2 w-full bg-gray-200 rounded-full overflow-hidden', className)}>
      <View 
        className="h-full bg-primary rounded-full transition-all"
        style={{ width: `${percentage}%` }}
      />
    </View>
  );
}


