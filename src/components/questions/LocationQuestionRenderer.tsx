import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { BaseQuestionRenderer, BaseQuestionRendererProps } from './BaseQuestionRenderer';
import { LocationQuestion } from '@/types/forms';

interface LocationQuestionRendererProps extends Omit<BaseQuestionRendererProps, 'children'> {
  question: LocationQuestion;
}

interface LocationData {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  timestamp?: number;
  address?: string;
}

export function LocationQuestionRenderer({
  question,
  value,
  onChange,
  error,
  isPreviewMode,
}: LocationQuestionRendererProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const locationData: LocationData | null = value ? JSON.parse(value) : null;

  const requestLocationPermission = async (): Promise<boolean> => {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Location permission is required to capture GPS coordinates.',
        [{ text: 'OK' }]
      );
      return false;
    }

    // Request background permission if needed
    if (question.accuracy === 'high') {
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        Alert.alert(
          'Background Permission',
          'Background location permission is recommended for high accuracy GPS.',
          [{ text: 'OK' }]
        );
      }
    }

    return true;
  };

  const captureLocation = async () => {
    if (isPreviewMode) return;

    try {
      setIsCapturing(true);

      // Request permissions
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        setIsCapturing(false);
        return;
      }

      // Get current location
      const accuracyLevel = question.accuracy || 'medium';
      const locationOptions: Location.LocationOptions = {
        accuracy: accuracyLevel === 'high' 
          ? Location.Accuracy.Highest 
          : accuracyLevel === 'medium'
          ? Location.Accuracy.Balanced
          : Location.Accuracy.Lowest,
        timeInterval: 1000,
        distanceInterval: 1,
      };

      const location = await Location.getCurrentPositionAsync(locationOptions);

      // Build location data
      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude || undefined,
        accuracy: location.coords.accuracy || undefined,
        timestamp: Date.now(),
      };

      // Optionally reverse geocode for address
      if (question.includeAddress) {
        try {
          const [reverseGeocode] = await Location.reverseGeocodeAsync({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });

          if (reverseGeocode) {
            const addressParts = [
              reverseGeocode.street,
              reverseGeocode.city,
              reverseGeocode.region,
              reverseGeocode.country,
            ].filter(Boolean);
            locationData.address = addressParts.join(', ');
          }
        } catch (geocodeError) {
          console.warn('Reverse geocoding failed:', geocodeError);
        }
      }

      // Store as JSON string
      onChange?.(JSON.stringify(locationData));
    } catch (error: any) {
      console.error('Error capturing location:', error);
      Alert.alert(
        'Location Error',
        error.message || 'Failed to capture location. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsCapturing(false);
    }
  };

  const clearLocation = () => {
    Alert.alert(
      'Clear Location',
      'Are you sure you want to clear the captured location?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => onChange?.(undefined),
        },
      ]
    );
  };

  const formatCoordinates = (lat: number, lng: number): string => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  return (
    <BaseQuestionRenderer
      question={question}
      error={error}
      isPreviewMode={isPreviewMode}
    >
      {locationData ? (
        <View style={styles.locationContainer}>
          <View style={styles.locationInfo}>
            <Text style={styles.coordinates}>
              📍 {formatCoordinates(locationData.latitude, locationData.longitude)}
            </Text>
            {locationData.address && (
              <Text style={styles.address}>{locationData.address}</Text>
            )}
            {locationData.accuracy && (
              <Text style={styles.accuracy}>
                Accuracy: ±{locationData.accuracy.toFixed(0)}m
              </Text>
            )}
            {locationData.altitude && (
              <Text style={styles.altitude}>
                Altitude: {locationData.altitude.toFixed(0)}m
              </Text>
            )}
          </View>
          {!isPreviewMode && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearLocation}
              activeOpacity={0.7}
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
          onPress={captureLocation}
          disabled={isPreviewMode || isCapturing}
          activeOpacity={0.7}
        >
          {isCapturing ? (
            <>
              <ActivityIndicator color="#ffffff" style={styles.loader} />
              <Text style={styles.captureButtonText}>Capturing location...</Text>
            </>
          ) : (
            <>
              <Text style={styles.captureButtonIcon}>📍</Text>
              <Text style={styles.captureButtonText}>Capture GPS Location</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </BaseQuestionRenderer>
  );
}

const styles = StyleSheet.create({
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 44,
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  captureButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  captureButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  loader: {
    marginRight: 8,
  },
  locationContainer: {
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#ecfdf5',
  },
  locationInfo: {
    marginBottom: 8,
  },
  coordinates: {
    fontSize: 16,
    fontWeight: '600',
    color: '#065f46',
    marginBottom: 4,
  },
  address: {
    fontSize: 14,
    color: '#047857',
    marginTop: 4,
  },
  accuracy: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  altitude: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  clearButton: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#dc2626',
  },
  clearButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});

