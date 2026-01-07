import React, { useState } from 'react';
import { View, TouchableOpacity, Modal, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Menu } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui';
import { Card, CardContent } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface TopNavBarProps {
  selectedProjectId?: string;
  onProjectChange?: (projectId: string) => void;
}

export function TopNavBar({ selectedProjectId, onProjectChange }: TopNavBarProps) {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);
  const [projectMenuVisible, setProjectMenuVisible] = useState(false);

  const availableProjects = user?.projectAccess || [];
  const currentProject = availableProjects.find(p => p.projectId === selectedProjectId) || availableProjects[0];

  const handleProjectSelect = (projectId: string) => {
    onProjectChange?.(projectId);
    setProjectMenuVisible(false);
    setMenuVisible(false);
  };

  const handleLogout = () => {
    logout();
    setMenuVisible(false);
    router.replace('/(tabs)' as any);
  };

  const handleLogin = () => {
    setMenuVisible(false);
    router.push('/(auth)/login' as any);
  };

  const handleSettings = () => {
    setMenuVisible(false);
    router.push('/(tabs)/settings' as any);
  };

  return (
    <>
      <View className="flex-row items-center justify-between px-4 py-3 bg-card border-b border-border">
        {/* Left: Project Name */}
        <View className="flex-1 min-w-0">
          {isAuthenticated && currentProject ? (
            <TouchableOpacity
              onPress={() => setProjectMenuVisible(true)}
              activeOpacity={0.7}
              className="flex-row items-center gap-2"
            >
              <MaterialIcons name="folder" size={20} color="#10B981" />
              <Text className="text-base font-semibold text-foreground truncate" numberOfLines={1}>
                {currentProject.projectName || 'Select Project'}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={20} color="#6B7280" />
            </TouchableOpacity>
          ) : (
            <Text className="text-base font-semibold text-foreground">
              ICS IDMS
            </Text>
          )}
        </View>

        {/* Right: Menu Button */}
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          activeOpacity={0.7}
          className="ml-4"
        >
          <View className="w-10 h-10 rounded-full bg-muted items-center justify-center">
            <Menu size={22} color="#6B7280" strokeWidth={2} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Main Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onPress={() => setMenuVisible(false)}
        >
          <View className="flex-1 justify-end">
            <Pressable onPress={(e) => e.stopPropagation()}>
              <Card className="bg-card rounded-t-3xl border-t border-border mx-0 mb-0">
                <CardContent className="p-4">
                  <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-lg font-semibold text-foreground">Menu</Text>
                    <TouchableOpacity
                      onPress={() => setMenuVisible(false)}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="close" size={24} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  <ScrollView>
                    {/* Project Selection */}
                    {isAuthenticated && availableProjects.length > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          setMenuVisible(false);
                          setProjectMenuVisible(true);
                        }}
                        activeOpacity={0.7}
                        className="flex-row items-center justify-between py-3 border-b border-border"
                      >
                        <View className="flex-row items-center gap-3">
                          <MaterialIcons name="folder" size={20} color="#10B981" />
                          <View>
                            <Text className="text-sm font-medium text-foreground">Project</Text>
                            <Text className="text-xs text-muted-foreground">
                              {currentProject?.projectName || 'Select Project'}
                            </Text>
                          </View>
                        </View>
                        <MaterialIcons name="chevron-right" size={20} color="#6B7280" />
                      </TouchableOpacity>
                    )}

                    {/* App Settings */}
                    {isAuthenticated && (
                      <TouchableOpacity
                        onPress={handleSettings}
                        activeOpacity={0.7}
                        className="flex-row items-center justify-between py-3 border-b border-border"
                      >
                        <View className="flex-row items-center gap-3">
                          <MaterialIcons name="settings" size={20} color="#6B7280" />
                          <Text className="text-sm font-medium text-foreground">App Settings</Text>
                        </View>
                        <MaterialIcons name="chevron-right" size={20} color="#6B7280" />
                      </TouchableOpacity>
                    )}

                    {/* Login/Logout */}
                    {isAuthenticated ? (
                      <TouchableOpacity
                        onPress={handleLogout}
                        activeOpacity={0.7}
                        className="flex-row items-center gap-3 py-3"
                      >
                        <MaterialIcons name="logout" size={20} color="#DC2626" />
                        <Text className="text-sm font-medium text-destructive">Logout</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={handleLogin}
                        activeOpacity={0.7}
                        className="flex-row items-center gap-3 py-3"
                      >
                        <MaterialIcons name="login" size={20} color="#10B981" />
                        <Text className="text-sm font-medium text-primary">Login</Text>
                      </TouchableOpacity>
                    )}

                    {/* User Info */}
                    {isAuthenticated && user && (
                      <View className="mt-4 pt-4 border-t border-border">
                        <Text className="text-xs text-muted-foreground">
                          Logged in as: {user.firstName} {user.lastName}
                        </Text>
                        {user.email && (
                          <Text className="text-xs text-muted-foreground mt-1">
                            {user.email}
                          </Text>
                        )}
                      </View>
                    )}
                  </ScrollView>
                </CardContent>
              </Card>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Project Selection Modal */}
      <Modal
        visible={projectMenuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setProjectMenuVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onPress={() => setProjectMenuVisible(false)}
        >
          <View className="flex-1 justify-end">
            <Pressable onPress={(e) => e.stopPropagation()}>
              <Card className="bg-card rounded-t-3xl border-t border-border mx-0 mb-0 max-h-[80%]">
                <CardContent className="p-4">
                  <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-lg font-semibold text-foreground">Select Project</Text>
                    <TouchableOpacity
                      onPress={() => setProjectMenuVisible(false)}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="close" size={24} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  <ScrollView>
                    {availableProjects.length === 0 ? (
                      <Text className="text-sm text-muted-foreground text-center py-4">
                        No projects available
                      </Text>
                    ) : (
                      availableProjects.map((project) => (
                        <TouchableOpacity
                          key={project.projectId}
                          onPress={() => handleProjectSelect(project.projectId)}
                          activeOpacity={0.7}
                          className={cn(
                            'flex-row items-center justify-between py-3 px-2 rounded-lg mb-2',
                            selectedProjectId === project.projectId && 'bg-emerald-50'
                          )}
                        >
                          <View className="flex-row items-center gap-3 flex-1">
                            <MaterialIcons
                              name={selectedProjectId === project.projectId ? 'folder' : 'folder-outline'}
                              size={20}
                              color={selectedProjectId === project.projectId ? '#10B981' : '#6B7280'}
                            />
                            <Text
                              className={cn(
                                'text-sm flex-1',
                                selectedProjectId === project.projectId
                                  ? 'font-semibold text-primary'
                                  : 'text-foreground'
                              )}
                              numberOfLines={1}
                            >
                              {project.projectName}
                            </Text>
                          </View>
                          {selectedProjectId === project.projectId && (
                            <MaterialIcons name="check-circle" size={20} color="#10B981" />
                          )}
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                </CardContent>
              </Card>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

    </>
  );
}

