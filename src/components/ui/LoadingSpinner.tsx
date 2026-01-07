import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, withSpring, Easing, runOnJS } from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import { Text } from './text';
import { useTheme } from '@/contexts/ThemeContext';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  text?: string;
  fullScreen?: boolean;
  visible?: boolean;
  success?: boolean;
  onSuccessComplete?: () => void;
}

export function LoadingSpinner({
  size = 'large',
  color = '#10B981',
  text,
  fullScreen = false,
  visible = true,
  success = false,
  onSuccessComplete,
}: LoadingSpinnerProps) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const spinnerOpacity = useSharedValue(1);
  const spinnerScale = useSharedValue(1);

  // Safe callback wrapper that handles errors
  const safeCallback = React.useCallback(() => {
    try {
      onSuccessComplete?.();
    } catch (error) {
      console.error('Error in onSuccessComplete callback:', error);
    }
  }, [onSuccessComplete]);

  useEffect(() => {
    if (success) {
      try {
        // Hide spinner
        spinnerOpacity.value = withTiming(0, { duration: 200 });
        spinnerScale.value = withTiming(0.8, { duration: 200 });
        
        // Show tick with bounce animation
        opacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) });
        scale.value = withSequence(
          withSpring(1.2, { damping: 8, stiffness: 100 }),
          withSpring(1, { damping: 8, stiffness: 100 })
        );
        
        // Hide after 1 second and call callback
        const timer = setTimeout(() => {
          try {
            opacity.value = withTiming(0, { duration: 200 }, (finished) => {
              if (finished) {
                // Use runOnJS to safely call JavaScript function from worklet context
                runOnJS(safeCallback)();
              }
            });
          } catch (error) {
            console.error('Error animating tick fade out:', error);
            // Fallback: call callback directly if animation fails
            safeCallback();
          }
        }, 1000);

        return () => {
          try {
            clearTimeout(timer);
          } catch (error) {
            console.error('Error clearing timer:', error);
          }
        };
      } catch (error) {
        console.error('Error in success animation setup:', error);
        // Fallback: try to call callback even if animation fails
        safeCallback();
      }
    } else {
      try {
        // Reset values when not in success state
        scale.value = 0;
        opacity.value = 0;
        spinnerOpacity.value = 1;
        spinnerScale.value = 1;
      } catch (error) {
        console.error('Error resetting animation values:', error);
      }
    }
  }, [success, safeCallback, scale, opacity, spinnerOpacity, spinnerScale]);

  const animatedTickStyle = useAnimatedStyle(() => {
    try {
      return {
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
      };
    } catch (error) {
      console.error('Error in animatedTickStyle:', error);
      return {
        transform: [{ scale: 1 }],
        opacity: 1,
      };
    }
  });

  const animatedSpinnerStyle = useAnimatedStyle(() => {
    try {
      return {
        opacity: spinnerOpacity.value,
        transform: [{ scale: spinnerScale.value }],
      };
    } catch (error) {
      console.error('Error in animatedSpinnerStyle:', error);
      return {
        opacity: 1,
        transform: [{ scale: 1 }],
      };
    }
  });

  try {
    if (fullScreen) {
      return (
        <Modal
          visible={visible}
          transparent={true}
          animationType="fade"
          statusBarTranslucent={true}
          onRequestClose={() => {
            // Handle Android back button if needed
            try {
              onSuccessComplete?.();
            } catch (error) {
              console.error('Error in onRequestClose callback:', error);
            }
          }}
        >
          <View 
            className={`flex-1 items-center justify-center p-8 ${
              colorScheme === 'dark' 
                ? 'bg-black/95' 
                : 'bg-white/98'
            }`}
            style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
          >
            <View className="items-center justify-center p-12 bg-card rounded-2xl shadow-lg min-w-[280px] min-h-[200px] w-[85%] max-w-[400px]">
              {!success ? (
                <Animated.View style={[styles.spinnerContainer, animatedSpinnerStyle]}>
                  <ActivityIndicator size="large" color={color} />
                </Animated.View>
              ) : (
                <Animated.View style={[styles.tickContainer, animatedTickStyle]}>
                  <View className="w-[120px] h-[120px] rounded-full border-4 border-primary items-center justify-center bg-primary/10">
                    <Check size={64} color="#10B981" strokeWidth={3} />
                  </View>
                </Animated.View>
              )}
              {text && (
                <Text className="mt-5 text-base text-foreground text-center font-medium leading-6">
                  {text}
                </Text>
              )}
            </View>
          </View>
        </Modal>
      );
    }

    return (
      <View className="p-5 items-center justify-center">
        <ActivityIndicator size={size} color={color} />
        {text && (
          <Text className="mt-5 text-base text-foreground text-center font-medium leading-6">
            {text}
          </Text>
        )}
      </View>
    );
  } catch (error) {
    console.error('Error rendering LoadingSpinner:', error);
    // Fallback rendering
    return (
      <View className="p-5 items-center justify-center">
        <ActivityIndicator size={size} color={color} />
        {text && (
          <Text className="mt-5 text-base text-foreground text-center font-medium leading-6">
            {text}
          </Text>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  spinnerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
