import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FileEdit, ChevronRight, Search, Filter, Trash2, Send } from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui';
import { Checkbox } from '@/components/ui/Checkbox';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { useForm } from '@/contexts/FormContext';
import { LocalFormResponse } from '@/types/forms';

type SortOption = 'newest' | 'oldest' | 'title-asc' | 'title-desc';

export default function DraftsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { responses, isLoadingResponses, refreshResponses, deleteResponse, updateResponseStatus } = useForm();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [showSearch, setShowSearch] = useState(false);
  const [showSort, setShowSort] = useState(false);

  // Debug logging for UI state
  console.log('📱 [DraftsScreen] Component rendered:', {
    isLoadingResponses,
    draftsCount: responses?.drafts?.length || 0,
    draftsSample: responses?.drafts?.slice(0, 2).map(r => ({
      id: r.id,
      formTitle: r.formTitle,
      dataKeys: Object.keys(r.data || {}),
      status: r.status,
      createdAt: r.createdAt
    })) || [],
    searchQuery,
    sortOption,
    refreshing
  });

  useEffect(() => {
    console.log('🔄 [DraftsScreen] Component mounted - refreshing responses');
    refreshResponses();
  }, []);

  const onRefresh = async () => {
    console.log('🔄 [DraftsScreen.onRefresh] Manual refresh triggered');
    setRefreshing(true);
    await refreshResponses();
    console.log('✅ [DraftsScreen.onRefresh] Manual refresh completed');
    setRefreshing(false);
  };

  const handleEditResponse = (response: LocalFormResponse) => {
    if (selectedItems.size > 0) {
      handleToggleSelection(response.id);
    } else {
    router.push(`/form/${response.formId}/fill?responseId=${response.id}` as any);
    }
  };

  const handleToggleSelection = (responseId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(responseId)) {
      newSelected.delete(responseId);
    } else {
      newSelected.add(responseId);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedItems.size === filteredAndSortedDrafts.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredAndSortedDrafts.map((item) => item.id)));
    }
  };

  // Search function - searches in form titles and response data
  const searchInResponse = (response: LocalFormResponse, query: string): boolean => {
    const lowerQuery = query.toLowerCase();
    
    // Search in form title
    if (response.formTitle?.toLowerCase().includes(lowerQuery)) {
      return true;
    }
    
    // Search in response data
    const searchInObject = (obj: any): boolean => {
      if (typeof obj === 'string' && obj.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      if (Array.isArray(obj)) {
        return obj.some(item => searchInObject(item));
      }
      if (obj && typeof obj === 'object') {
        return Object.values(obj).some(value => searchInObject(value));
      }
      return false;
    };
    
    return searchInObject(response.data);
  };

  // Filter and sort drafts
  const filteredAndSortedDrafts = useMemo(() => {
    console.log('🔄 [DraftsScreen.filteredAndSortedDrafts] Computing filtered drafts:', {
      rawDraftsCount: responses.drafts?.length || 0,
      searchQuery: searchQuery.trim(),
      sortOption,
      rawDraftsSample: responses.drafts?.slice(0, 2).map(r => ({
        id: r.id,
        formTitle: r.formTitle,
        status: r.status,
        updatedAt: r.updatedAt
      })) || []
    });

    let filtered = responses.drafts;
    
    // Apply search filter
    if (searchQuery.trim()) {
      console.log('🔍 [DraftsScreen] Applying search filter:', { query: searchQuery.trim() });
      filtered = filtered.filter(response => {
        const matches = searchInResponse(response, searchQuery);
        console.log('🔍 [DraftsScreen] Search result:', {
          responseId: response.id,
          formTitle: response.formTitle,
          matches
        });
        return matches;
      });
      console.log('🔍 [DraftsScreen] After search filter:', { filteredCount: filtered.length });
    }
    
    // Apply sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'newest':
          return b.updatedAt - a.updatedAt;
        case 'oldest':
          return a.updatedAt - b.updatedAt;
        case 'title-asc':
          return (a.formTitle || 'Untitled Form').localeCompare(b.formTitle || 'Untitled Form');
        case 'title-desc':
          return (b.formTitle || 'Untitled Form').localeCompare(a.formTitle || 'Untitled Form');
        default:
          return 0;
      }
    });
    
    console.log('✅ [DraftsScreen] Final filtered and sorted drafts:', {
      finalCount: sorted.length,
      sortOption,
      finalSample: sorted.slice(0, 2).map(r => ({
        id: r.id,
        formTitle: r.formTitle,
        status: r.status,
        updatedAt: r.updatedAt
      }))
    });
    
    return sorted;
  }, [responses.drafts, searchQuery, sortOption]);

  const handleBatchDelete = async () => {
    if (selectedItems.size === 0) {
      Alert.alert('No Selection', 'Please select at least one draft to delete.');
      return;
    }

    Alert.alert(
      'Delete Drafts',
      `Are you sure you want to delete ${selectedItems.size} draft(s)? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              let successCount = 0;
              let errorCount = 0;

              for (const responseId of selectedItems) {
                try {
                  await deleteResponse(responseId);
                  successCount++;
                } catch (error) {
                  console.error(`Failed to delete draft ${responseId}:`, error);
                  errorCount++;
                }
              }

              setSelectedItems(new Set());
              await refreshResponses();

              if (errorCount === 0) {
                Alert.alert('Success', `Successfully deleted ${successCount} draft(s).`);
              } else if (successCount > 0) {
                Alert.alert(
                  'Partial Success',
                  `Deleted ${successCount} draft(s). ${errorCount} draft(s) failed.`
                );
              } else {
                Alert.alert('Error', `Failed to delete ${errorCount} draft(s). Please try again.`);
              }
            } catch (error) {
              console.error('Error deleting drafts:', error);
              const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
              Alert.alert('Error', `Failed to delete drafts: ${errorMessage}`);
            }
          },
        },
      ]
    );
  };

  const handleBatchReadyToSend = async () => {
    if (selectedItems.size === 0) {
      Alert.alert('No Selection', 'Please select at least one draft to mark as ready to send.');
      return;
    }

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const responseId of selectedItems) {
        try {
          await updateResponseStatus(responseId, 'ready_to_send');
          successCount++;
        } catch (error) {
          console.error(`Failed to mark draft ${responseId} as ready:`, error);
          errorCount++;
        }
      }

      setSelectedItems(new Set());
      await refreshResponses();

      if (errorCount === 0) {
        Alert.alert('Success', `Successfully marked ${successCount} draft(s) as ready to send.`);
      } else if (successCount > 0) {
        Alert.alert(
          'Partial Success',
          `Marked ${successCount} draft(s) as ready. ${errorCount} draft(s) failed.`
        );
      } else {
        Alert.alert('Error', `Failed to mark ${errorCount} draft(s) as ready. Please try again.`);
      }
    } catch (error) {
      console.error('Error marking drafts as ready:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Error', `Failed to mark drafts as ready: ${errorMessage}`);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getSortLabel = (option: SortOption) => {
    switch (option) {
      case 'newest':
        return 'Newest First';
      case 'oldest':
        return 'Oldest First';
      case 'title-asc':
        return 'Title A-Z';
      case 'title-desc':
        return 'Title Z-A';
    }
  };

  const renderResponseItem = ({ item }: { item: LocalFormResponse }) => {
    const isSelected = selectedItems.has(item.id);
    const hasSelection = selectedItems.size > 0;

    return (
      <TouchableOpacity
        onPress={() => handleEditResponse(item)}
        onLongPress={() => handleToggleSelection(item.id)}
        activeOpacity={0.7}
      >
        <Card className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden mb-3 mx-4">
          <CardContent className="flex-row items-center py-3 px-3">
            {hasSelection && (
              <View className="mr-3">
                <Checkbox checked={isSelected} onPress={() => handleToggleSelection(item.id)} />
              </View>
            )}
            <View className="w-10 h-10 rounded-xl bg-emerald-100 items-center justify-center mr-3">
              <FileEdit size={20} color="#10B981" strokeWidth={2} />
            </View>
            <View className="flex-1 min-w-0 mr-3">
              <Text className="text-base font-semibold text-foreground">{item.formTitle || 'Untitled Form'}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">Draft • Incomplete</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">{formatDate(item.updatedAt)}</Text>
            </View>
            {!hasSelection && (
              <View className="ml-2">
                <ChevronRight size={18} color="#9CA3AF" />
        </View>
            )}
          </CardContent>
      </Card>
    </TouchableOpacity>
  );
  };

  if (isLoadingResponses) {
    return (
      <>
        <View className="flex-1 bg-background" style={{ paddingTop: insets.top }} />
        <LoadingSpinner fullScreen text="Loading drafts..." visible={isLoadingResponses} />
      </>
    );
  }

  const allSelected = filteredAndSortedDrafts.length > 0 && selectedItems.size === filteredAndSortedDrafts.length;
  const hasSelection = selectedItems.size > 0;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <OfflineBanner />
      
      {/* Header */}
      <View className="flex-row justify-between items-center px-4 py-3 bg-card border-b border-border">
        <Text className="text-lg font-semibold text-foreground">Drafts</Text>
        <View className="flex-row gap-4">
          <TouchableOpacity
            className="p-1"
            activeOpacity={0.7}
            onPress={() => setShowSort(!showSort)}
          >
            <Filter size={20} color="#6B7280" strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity
            className="p-1"
            activeOpacity={0.7}
            onPress={() => setShowSearch(!showSearch)}
          >
            <Search size={20} color="#6B7280" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      {showSearch && (
        <View className="px-4 py-4 bg-card border-b border-border min-h-[72px]">
          <Input
            placeholder="Search drafts..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 min-h-[40px] px-3 py-2 text-base rounded-lg border border-border bg-background"
          />
        </View>
      )}

      {/* Sort Options */}
      {showSort && (
        <View className="px-4 py-3 bg-card border-b border-border">
          <Text className="text-sm font-semibold text-foreground mb-2">Sort by:</Text>
          <View className="flex-row flex-wrap gap-2">
            {(['newest', 'oldest', 'title-asc', 'title-desc'] as SortOption[]).map((option) => (
              <TouchableOpacity
                key={option}
                className={`px-3 py-1.5 rounded-lg border ${
                  sortOption === option 
                    ? 'bg-primary border-primary' 
                    : 'bg-muted/50 border-border'
                }`}
                onPress={() => {
                  setSortOption(option);
                  setShowSort(false);
                }}
              >
                <Text className={`text-xs font-medium ${
                  sortOption === option 
                    ? 'text-primary-foreground' 
                    : 'text-muted-foreground'
                }`}>
                  {getSortLabel(option)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Drafts List */}
      {(() => {
        console.log('🎨 [DraftsScreen] Rendering decision:', {
          filteredDraftsLength: filteredAndSortedDrafts.length,
          showingEmptyState: filteredAndSortedDrafts.length === 0,
          searchQuery,
          isLoadingResponses
        });
        return filteredAndSortedDrafts.length === 0;
      })() ? (
        <View className="flex-1 items-center justify-center p-8">
          <FileEdit size={64} color="#10B981" strokeWidth={1.5} />
          <Text className="text-xl font-semibold text-foreground mt-4 mb-2">
            {searchQuery ? 'No matching drafts' : 'No drafts'}
          </Text>
          <Text className="text-sm text-muted-foreground text-center">
            {searchQuery
              ? 'Try adjusting your search terms'
              : 'Start filling out a form to create a draft'}
          </Text>
        </View>
      ) : (
        <>
        <FlatList
            data={filteredAndSortedDrafts}
          renderItem={renderResponseItem}
          keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingTop: 8,
              paddingBottom: Math.max(insets.bottom, 16) + 60 + (hasSelection ? 70 : 0)
            }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />

          {/* Bottom Action Bar */}
          {hasSelection && (
            <View className="flex-row px-4 pt-3 bg-card border-t border-border gap-2 absolute bottom-0 left-0 right-0" style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
              <Button
                title={allSelected ? 'Deselect All' : 'Select All'}
                onPress={handleSelectAll}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                title={`Delete (${selectedItems.size})`}
                onPress={handleBatchDelete}
                variant="destructive"
                style={{ flex: 1 }}
              />
              <Button
                title={`Ready (${selectedItems.size})`}
                onPress={handleBatchReadyToSend}
                variant="default"
                style={{ flex: 1 }}
              />
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Styles removed - using Tailwind CSS classes for theme support
});

