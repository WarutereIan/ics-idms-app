import React, { useState } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Input } from '@/components/ui';
import { Button } from '@/components/ui';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Text } from '@/components/ui/text';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const { isDarkMode } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setError('');
    const result = await login(email, password);

    if (result.success) {
      router.replace('/(tabs)');
    } else {
      setError(result.error || 'Login failed. Please try again.');
    }
  };

  return (
    <LinearGradient
      colors={isDarkMode 
        ? ['#0F172A', '#1E293B'] // Dark gradient
        : ['#ECFDF5', '#D1FAE5'] // Light gradient
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ 
            justifyContent: 'center', 
            alignItems: 'center',
            padding: 16,
            paddingTop: 60,
            paddingBottom: 40,
            minHeight: '100%',
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: '100%', maxWidth: 400 }}>
            {/* Main Login Form */}
            <View className="bg-card border border-border rounded-xl p-6 shadow-lg">
              {/* Header */}
              <View className="items-center mb-6">
                {/* Logo */}
                <View className="h-12 w-12 mb-4 bg-primary rounded-lg items-center justify-center">
                  <Text className="text-primary-foreground text-xl font-bold"></Text>
                </View>
                <Text className="text-2xl font-bold text-foreground mb-2 text-center">
                  ICS IDMS Login
                </Text>
                <Text className="text-sm text-muted-foreground text-center">
                  Sign in to your account
                </Text>
              </View>

              {/* Form Content */}
              <View className="gap-4">
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Email Address</Text>
                  <View className="relative justify-center">
                    <MaterialIcons
                      name="email"
                      size={18}
                      color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                      style={{ position: 'absolute', left: 12, zIndex: 1, pointerEvents: 'none' }}
                    />
                    <Input
                      value={email}
                      onChangeText={setEmail}
                      placeholder="Enter your email"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      className="pl-10 h-10 border border-border rounded-md bg-background text-base text-foreground pr-3 py-2"
                      placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
                    />
                  </View>
                </View>

                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Password</Text>
                  <View className="relative justify-center">
                    <MaterialIcons
                      name="lock"
                      size={18}
                      color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                      style={{ position: 'absolute', left: 12, zIndex: 1, pointerEvents: 'none' }}
                    />
                    <Input
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Enter your password"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoComplete="password"
                      className="pl-10 pr-10 h-10 border border-border rounded-md bg-background text-base text-foreground py-2"
                      placeholderTextColor={isDarkMode ? '#9CA3AF' : '#6B7280'}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      className="absolute right-0 top-0 bottom-0 w-11 justify-center items-center"
                      activeOpacity={0.7}
                    >
                      <MaterialIcons
                        name={showPassword ? 'visibility-off' : 'visibility'}
                        size={20}
                        color={isDarkMode ? '#9CA3AF' : '#6B7280'}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {error && (
                  <View className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                    <Text className="text-sm text-destructive text-center">{error}</Text>
                  </View>
                )}

                <View className="mt-2 w-full">
                  <Button
                    title={isLoading ? 'Signing in...' : 'Sign In'}
                    onPress={handleLogin}
                    variant="default"
                    disabled={isLoading}
                    loading={isLoading}
                    className="w-full h-11 bg-primary rounded-md justify-center items-center shadow-sm"
                  />
                </View>
              </View>
            </View>

            {/* Signup Link */}
            <View className="pt-4 items-center">
              <Text className="text-sm text-muted-foreground text-center">
                Don't have an organization account?{' '}
                <Text
                  className="text-primary font-medium"
                  onPress={() => router.push('/(auth)/signup' as any)}
                >
                  Create one now
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
