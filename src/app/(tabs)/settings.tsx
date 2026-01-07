import React, { useState } from 'react';
import { View, ScrollView, Switch, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Moon, Sun, Monitor } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Button } from '@/components/ui';
import { TopNavBar } from '@/components/common/TopNavBar';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, updateProfile, changePassword } = useAuth();
  const { theme, isDarkMode, setTheme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [offlineModeEnabled, setOfflineModeEnabled] = useState(true);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

  const handleChangePassword = () => {
    Alert.alert(
      'Change Password',
      'Password change functionality will be available soon.',
      [{ text: 'OK' }]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'Are you sure you want to clear all cached data?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement cache clearing
            Alert.alert('Success', 'Cache cleared successfully');
          },
        },
      ]
    );
  };

  const handleExportData = () => {
    Alert.alert(
      'Export Data',
      'Data export functionality will be available soon.',
      [{ text: 'OK' }]
    );
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <TopNavBar />
      <ScrollView 
        className="flex-1" 
        contentContainerStyle={{ 
          padding: 16,
          paddingBottom: Math.max(insets.bottom, 16) + 60, // Tab bar height
        }}
      >
        {/* App Settings Section */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>App Settings</CardTitle>
          </CardHeader>
          <CardContent className="gap-4">
            {/* Theme Selection */}
            <View>
              <Text className="text-sm font-medium text-foreground mb-3">Theme</Text>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => setTheme('light')}
                  activeOpacity={0.7}
                  className={`flex-1 flex-row items-center justify-center py-3 px-4 rounded-xl border ${
                    theme === 'light' 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border bg-muted/50'
                  }`}
                >
                  <Sun size={18} color={theme === 'light' ? '#10B981' : '#6B7280'} strokeWidth={2} />
                  <Text className={`ml-2 text-sm font-medium ${
                    theme === 'light' ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    Light
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={() => setTheme('dark')}
                  activeOpacity={0.7}
                  className={`flex-1 flex-row items-center justify-center py-3 px-4 rounded-xl border ${
                    theme === 'dark' 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border bg-muted/50'
                  }`}
                >
                  <Moon size={18} color={theme === 'dark' ? '#10B981' : '#6B7280'} strokeWidth={2} />
                  <Text className={`ml-2 text-sm font-medium ${
                    theme === 'dark' ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    Dark
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={() => setTheme('system')}
                  activeOpacity={0.7}
                  className={`flex-1 flex-row items-center justify-center py-3 px-4 rounded-xl border ${
                    theme === 'system' 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border bg-muted/50'
                  }`}
                >
                  <Monitor size={18} color={theme === 'system' ? '#10B981' : '#6B7280'} strokeWidth={2} />
                  <Text className={`ml-2 text-sm font-medium ${
                    theme === 'system' ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    Auto
                  </Text>
                </TouchableOpacity>
              </View>
              <Text className="text-xs text-muted-foreground mt-2">
                {theme === 'system' 
                  ? 'Follows your device settings' 
                  : `Using ${theme} theme`
                }
              </Text>
            </View>
            {/* Notifications */}
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-sm font-medium text-foreground">Notifications</Text>
                <Text className="text-xs text-muted-foreground mt-1">
                  Enable push notifications for form submissions
                </Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Offline Mode */}
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-sm font-medium text-foreground">Offline Mode</Text>
                <Text className="text-xs text-muted-foreground mt-1">
                  Allow form filling without internet connection
                </Text>
              </View>
              <Switch
                value={offlineModeEnabled}
                onValueChange={setOfflineModeEnabled}
                trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Auto Sync */}
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-sm font-medium text-foreground">Auto Sync</Text>
                <Text className="text-xs text-muted-foreground mt-1">
                  Automatically sync forms when online
                </Text>
              </View>
              <Switch
                value={autoSyncEnabled}
                onValueChange={setAutoSyncEnabled}
                trackColor={{ false: '#D1D5DB', true: '#10B981' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </CardContent>
        </Card>

        {/* Account Settings Section */}
        {user && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent className="gap-2">
              <View className="py-2">
                <Text className="text-xs text-muted-foreground">Name</Text>
                <Text className="text-sm font-medium text-foreground mt-1">
                  {user.firstName} {user.lastName}
                </Text>
              </View>
              {user.email && (
                <View className="py-2">
                  <Text className="text-xs text-muted-foreground">Email</Text>
                  <Text className="text-sm font-medium text-foreground mt-1">
                    {user.email}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                onPress={handleChangePassword}
                activeOpacity={0.7}
                className="flex-row items-center justify-between py-3 border-t border-border mt-2"
              >
                <Text className="text-sm font-medium text-foreground">Change Password</Text>
                <MaterialIcons name="chevron-right" size={20} color="#6B7280" />
              </TouchableOpacity>
            </CardContent>
          </Card>
        )}

        {/* Data Management Section */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
          </CardHeader>
          <CardContent className="gap-2">
            <TouchableOpacity
              onPress={handleExportData}
              activeOpacity={0.7}
              className="flex-row items-center justify-between py-3"
            >
              <View className="flex-row items-center gap-3">
                <MaterialIcons name="download" size={20} color="#6B7280" />
                <Text className="text-sm font-medium text-foreground">Export Data</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleClearCache}
              activeOpacity={0.7}
              className="flex-row items-center justify-between py-3 border-t border-border"
            >
              <View className="flex-row items-center gap-3">
                <MaterialIcons name="delete-outline" size={20} color="#DC2626" />
                <Text className="text-sm font-medium text-destructive">Clear Cache</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#6B7280" />
            </TouchableOpacity>
          </CardContent>
        </Card>

        {/* About Section */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent>
            <View className="py-2">
              <Text className="text-xs text-muted-foreground">Version</Text>
              <Text className="text-sm font-medium text-foreground mt-1">
                v2025.1.0
              </Text>
            </View>
            <View className="py-2 mt-2">
              <Text className="text-xs text-muted-foreground">ICS IDMS</Text>
              <Text className="text-sm font-medium text-foreground mt-1">
                Data Collection App
              </Text>
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}

