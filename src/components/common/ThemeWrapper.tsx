import React, { ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface ThemeWrapperProps {
  children: ReactNode;
}

export function ThemeWrapper({ children }: ThemeWrapperProps) {
  const { isDarkMode } = useTheme();
  
  return (
    <View className={isDarkMode ? 'dark' : ''} style={{ flex: 1 }}>
      {children}
    </View>
  );
}

