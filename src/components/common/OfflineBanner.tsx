import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNetwork } from '@/contexts/NetworkContext';

export function OfflineBanner() {
  const { isOnline } = useNetwork();

  if (isOnline) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>You're offline. Changes will sync when you're back online.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#fef3c7',
    padding: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#fbbf24',
  },
  text: {
    color: '#92400e',
    fontSize: 14,
    fontWeight: '500',
  },
});

