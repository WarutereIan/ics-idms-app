import React from 'react';
import { StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

interface IconProps {
  icon: LucideIcon;
  size?: number;
  color?: string;
  className?: string;
}

export function Icon({ icon: IconComponent, size = 24, color = '#6B7280', className }: IconProps) {
  return <IconComponent size={size} color={color} style={StyleSheet.create({})} />;
}

