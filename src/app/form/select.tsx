import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClipboardList, FileText, ChevronRight } from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui';
import { Text } from '@/components/ui/text';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useForm } from '@/contexts/FormContext';
import { DownloadedForm } from '@/types/forms';

export default function SelectFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { downloadedForms, refreshDownloadedForms } = useForm();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    refreshDownloadedForms();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshDownloadedForms();
    setRefreshing(false);
  };

  const handleSelectForm = (form: DownloadedForm) => {
    router.push(`/form/${form.formId}/fill` as any);
  };

  const renderFormItem = ({ item: form }: { item: DownloadedForm }) => (
    <TouchableOpacity onPress={() => handleSelectForm(form)} activeOpacity={0.7}>
      <Card className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden mb-3">
        <CardContent className="flex-row items-center py-3 px-3">
          <View className="w-10 h-10 rounded-xl bg-purple-100 items-center justify-center mr-3">
            <FileText size={20} color="#8B5CF6" strokeWidth={2} />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-base font-semibold text-foreground">{form.title}</Text>
        {form.description && (
              <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
            {form.description}
          </Text>
        )}
        {form.projectName && (
              <Text className="text-xs text-muted-foreground mt-0.5">
                {form.projectName}
              </Text>
        )}
          </View>
          <View className="ml-2">
            <ChevronRight size={18} color="#9CA3AF" />
          </View>
        </CardContent>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-4 py-4 bg-card border-b border-border">
        <Text className="text-2xl font-bold text-foreground mb-1">Select Form</Text>
        <Text className="text-sm text-muted-foreground">Choose a form to fill out</Text>
      </View>

      {downloadedForms.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <ClipboardList size={64} color="#6B7280" strokeWidth={1.5} />
          <Text className="text-xl font-semibold text-foreground mt-4 mb-2">No forms downloaded</Text>
          <Text className="text-sm text-muted-foreground text-center">
            Download forms from the Download Form tab to start collecting data
          </Text>
        </View>
      ) : (
        <FlatList
          data={downloadedForms}
          renderItem={renderFormItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: Math.max(insets.bottom, 16)
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

