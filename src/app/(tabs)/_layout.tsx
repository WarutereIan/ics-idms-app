import { Stack } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
          <Stack.Screen name="index" />
          <Stack.Screen name="drafts" />
          <Stack.Screen name="ready-to-send" />
          <Stack.Screen name="sent" />
          <Stack.Screen name="download-form" />
          <Stack.Screen name="delete-form" />
          <Stack.Screen name="settings" />
    </Stack>
  );
}
