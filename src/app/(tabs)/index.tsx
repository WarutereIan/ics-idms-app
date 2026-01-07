import React, { useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import { 
  FileEdit, 
  Send, 
  CheckCircle2, 
  Download, 
  Trash2,
  Plus,
  ChevronRight
} from 'lucide-react-native';
import { Button } from '@/components/ui';
import { Card, CardContent } from '@/components/ui';
import { Badge } from '@/components/ui';
import { Text } from '@/components/ui/text';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { TopNavBar } from '@/components/common/TopNavBar';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { useForm } from '@/contexts/FormContext';
import { cn } from '@/lib/utils';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { selectedProject, setSelectedProjectId } = useProject();
  const { responseCounts, isLoadingForms, refreshResponses, refreshDownloadedForms } = useForm();
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      refreshResponses();
      refreshDownloadedForms();
    }
  }, [isAuthenticated]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshResponses(), refreshDownloadedForms()]);
    setRefreshing(false);
  };

  const handleStartNewForm = () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login' as any);
      return;
    }
    router.push('/form/select' as any);
  };

  if (authLoading) {
    return (
      <>
        <View className="flex-1">
          <TopNavBar selectedProjectId={selectedProject?.projectId || undefined} onProjectChange={setSelectedProjectId} />
        </View>
        <LoadingSpinner fullScreen text="Loading..." visible={authLoading} />
      </>
    );
  }

  // Get project name or default
  const projectName = selectedProject?.projectName || user?.projectAccess?.[0]?.projectName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'ICS IDMS';

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <TopNavBar 
        selectedProjectId={selectedProject?.projectId || undefined} 
        onProjectChange={setSelectedProjectId} 
      />
      <OfflineBanner />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ 
          padding: 16,
          paddingBottom: Math.max(insets.bottom, 16) + 60, // Tab bar height (~60px) + safe area
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          isAuthenticated ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          ) : undefined
        }
      >
        {/* Header */}
        <View className="mb-4">
          <Text className="text-2xl font-bold text-foreground">
            {projectName}
          </Text>
          {!isAuthenticated && (
            <Text className="text-sm text-muted-foreground mt-1.5">
              Sign in to access your forms and projects
            </Text>
          )}
        </View>

        {/* Start New Form Button */}
        <View className="mb-4">
          <Button
            title="Collect New Form"
            onPress={handleStartNewForm}
            variant="default"
            className="w-full"
          />
        </View>

        {/* Navigation Cards */}
        <View className="gap-2">
          <Link href="/(tabs)/drafts" asChild>
            <Pressable>
              <Card className="bg-card border border-border shadow-sm rounded-full overflow-hidden">
                <CardContent className="flex-row items-center py-0 px-3">
                  <View className="w-9 h-9 rounded-xl bg-emerald-100 items-center justify-center mr-2.5">
                    <FileEdit size={18} color="#10B981" strokeWidth={2} />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-base font-semibold text-foreground">Drafts</Text>
                    <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
                      View and edit incomplete forms
                    </Text>
                  </View>
                  <View className="ml-2">
                    <ChevronRight size={18} color="#9CA3AF" />
                  </View>
                </CardContent>
              </Card>
            </Pressable>
          </Link>

          <Link href="/(tabs)/ready-to-send" asChild>
            <Pressable>
              <Card className="bg-card border border-border shadow-sm rounded-full overflow-hidden">
                <CardContent className="flex-row items-center py-0 px-3">
                  <View className="w-9 h-9 rounded-xl bg-blue-100 items-center justify-center mr-2.5">
                    <Send size={18} color="#3B82F6" strokeWidth={2} />
                  </View>
                  <View className="flex-1 min-w-0">
                    <View className="flex-row items-center gap-2 flex-wrap">
                      <Text className="text-base font-semibold text-foreground">Ready to send</Text>
                      {responseCounts.readyToSend > 0 && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 px-1.5 py-0">
                          <Text>{responseCounts.readyToSend}</Text>
                        </Badge>
                      )}
                    </View>
                    <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
                      Forms ready for submission
                    </Text>
                  </View>
                  <View className="ml-2">
                    <ChevronRight size={18} color="#9CA3AF" />
                  </View>
                </CardContent>
              </Card>
            </Pressable>
          </Link>

          <Link href="/(tabs)/sent" asChild>
            <Pressable>
              <Card className="bg-card border border-border shadow-sm rounded-full overflow-hidden">
                <CardContent className="flex-row items-center py-0 px-3">
                  <View className="w-9 h-9 rounded-xl bg-green-100 items-center justify-center mr-2.5">
                    <CheckCircle2 size={18} color="#10B981" strokeWidth={2} />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-base font-semibold text-foreground">Sent</Text>
                    <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
                      View submitted forms
                    </Text>
                  </View>
                  <View className="ml-2">
                    <ChevronRight size={18} color="#9CA3AF" />
                  </View>
                </CardContent>
              </Card>
            </Pressable>
          </Link>

          <Link href="/(tabs)/download-form" asChild>
            <Pressable>
              <Card className="bg-card border border-border shadow-sm rounded-full overflow-hidden">
                <CardContent className="flex-row items-center py-0 px-3">
                  <View className="w-9 h-9 rounded-xl bg-purple-100 items-center justify-center mr-2.5">
                    <Download size={18} color="#8B5CF6" strokeWidth={2} />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-base font-semibold text-foreground">Download form</Text>
                    <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
                      Get forms from the server
                    </Text>
                  </View>
                  <View className="ml-2">
                    <ChevronRight size={18} color="#9CA3AF" />
                  </View>
                </CardContent>
              </Card>
            </Pressable>
          </Link>

          <Link href="/(tabs)/delete-form" asChild>
            <Pressable>
              <Card className="bg-card border border-border shadow-sm rounded-full overflow-hidden">
                <CardContent className="flex-row items-center py-0 px-3">
                  <View className="w-9 h-9 rounded-xl bg-red-100 items-center justify-center mr-2.5">
                    <Trash2 size={18} color="#EF4444" strokeWidth={2} />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-base font-semibold text-foreground">Delete form</Text>
                    <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
                      Remove downloaded forms
                    </Text>
                  </View>
                  <View className="ml-2">
                    <ChevronRight size={18} color="#9CA3AF" />
                  </View>
                </CardContent>
              </Card>
            </Pressable>
          </Link>
        </View>

        {/* Version Info */}
        <View className="mt-8 mb-4 items-center">
          <Text className="text-xs text-muted-foreground">
            ICS IDMS
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
