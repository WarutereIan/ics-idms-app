import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import uuid from 'react-native-uuid';
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a UUID v4 string
 * Uses the uuid package for reliable UUID generation
 */
export function generateUUID(): string {
  return uuid.v4() as string;
}

