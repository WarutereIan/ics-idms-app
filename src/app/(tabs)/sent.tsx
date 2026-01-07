import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CheckCircle2, ChevronRight } from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui';
import { Text } from '@/components/ui/text';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { useForm } from '@/contexts/FormContext';
import { LocalFormResponse } from '@/types/forms';

export default function SentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { responses, isLoadingResponses, refreshResponses } = useForm();
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    refreshResponses();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshResponses();
    setRefreshing(false);
  };

  const handleViewResponse = (response: LocalFormResponse) => {
    // For sent responses, we show read-only view
    router.push(`/form/${response.formId}/fill?responseId=${response.id}&readOnly=true` as any);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderResponseItem = ({ item }: { item: LocalFormResponse }) => (
    <TouchableOpacity onPress={() => handleViewResponse(item)} activeOpacity={0.7}>
      <Card className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden mb-3 mx-4">
        <CardContent className="flex-row items-center py-3 px-3">
          <View className="w-10 h-10 rounded-xl bg-green-100 items-center justify-center mr-3">
            <CheckCircle2 size={20} color="#10B981" strokeWidth={2} />
          </View>
          <View className="flex-1 min-w-0 mr-3">
            <View className="flex-row items-center gap-2 flex-wrap mb-0.5">
              <Text className="text-base font-semibold text-foreground flex-1">{item.formTitle || 'Untitled Form'}</Text>
              <View className="bg-green-100 px-2 py-1 rounded-md">
                <Text className="text-xs text-green-700 font-semibold">✓ Sent</Text>
              </View>
        </View>
        {item.syncedAt && (
              <Text className="text-xs text-muted-foreground">Sent: {formatDate(item.syncedAt)}</Text>
        )}
            <Text className="text-xs text-muted-foreground mt-0.5">Created: {formatDate(item.createdAt)}</Text>
          </View>
          <View className="ml-2">
            <ChevronRight size={18} color="#9CA3AF" />
          </View>
        </CardContent>
      </Card>
    </TouchableOpacity>
  );

  if (isLoadingResponses) {
    return (
      <View className="flex-1 bg-background">
        <LoadingSpinner fullScreen text="Loading sent forms..." />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <OfflineBanner />
      {responses.sent.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <CheckCircle2 size={64} color="#10B981" strokeWidth={1.5} />
          <Text className="text-xl font-semibold text-foreground mt-4 mb-2">No sent forms</Text>
          <Text className="text-sm text-muted-foreground text-center">
            Forms you submit will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={responses.sent}
          renderItem={renderResponseItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 16) + 60
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Styles removed - using Tailwind CSS classes for theme support
});

