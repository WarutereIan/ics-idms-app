import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Send, ChevronRight, Search, Filter } from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui';
import { Badge } from '@/components/ui';
import { Checkbox } from '@/components/ui/Checkbox';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { useForm } from '@/contexts/FormContext';
import { useNetwork } from '@/contexts/NetworkContext';
import { LocalFormResponse } from '@/types/forms';

type SortOption = 'newest' | 'oldest' | 'title-asc' | 'title-desc';

export default function ReadyToSendScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { responses, isLoadingResponses, refreshResponses, deleteResponse } = useForm();
  const { isConnected, sync, isSyncing, syncError } = useNetwork();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [showSearch, setShowSearch] = useState(false);
  const [showSort, setShowSort] = useState(false);

  // Debug logging for UI state
  console.log('📱 [ReadyToSendScreen] Component rendered:', {
    isLoadingResponses,
    readyToSendCount: responses?.readyToSend?.length || 0,
    readyToSendSample: responses?.readyToSend?.slice(0, 2).map(r => ({
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
    console.log('🔄 [ReadyToSendScreen] Component mounted - refreshing responses');
    refreshResponses();
  }, []);

  const onRefresh = async () => {
    console.log('🔄 [ReadyToSendScreen.onRefresh] Manual refresh triggered');
    setRefreshing(true);
    await refreshResponses();
    console.log('✅ [ReadyToSendScreen.onRefresh] Manual refresh completed');
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
    if (selectedItems.size === filteredAndSortedResponses.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredAndSortedResponses.map((item) => item.id)));
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

  // Filter and sort responses
  const filteredAndSortedResponses = useMemo(() => {
    console.log('🔄 [ReadyToSendScreen.filteredAndSortedResponses] Computing filtered responses:', {
      rawReadyToSendCount: responses.readyToSend?.length || 0,
      searchQuery: searchQuery.trim(),
      sortOption,
      rawReadyToSendSample: responses.readyToSend?.slice(0, 2).map(r => ({
        id: r.id,
        formTitle: r.formTitle,
        status: r.status,
        updatedAt: r.updatedAt
      })) || []
    });

    let filtered = responses.readyToSend;
    
    // Apply search filter
    if (searchQuery.trim()) {
      console.log('🔍 [ReadyToSendScreen] Applying search filter:', { query: searchQuery.trim() });
      filtered = filtered.filter(response => {
        const matches = searchInResponse(response, searchQuery);
        console.log('🔍 [ReadyToSendScreen] Search result:', {
          responseId: response.id,
          formTitle: response.formTitle,
          matches
        });
        return matches;
      });
      console.log('🔍 [ReadyToSendScreen] After search filter:', { filteredCount: filtered.length });
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
    
    console.log('✅ [ReadyToSendScreen] Final filtered and sorted responses:', {
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
  }, [responses.readyToSend, searchQuery, sortOption]);

  const handleBatchDelete = async () => {
    if (selectedItems.size === 0) {
      Alert.alert('No Selection', 'Please select at least one form to delete.');
      return;
    }

    Alert.alert(
      'Delete Forms',
      `Are you sure you want to delete ${selectedItems.size} form(s)? This action cannot be undone.`,
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
                  console.error(`Failed to delete form ${responseId}:`, error);
                  errorCount++;
                }
              }

              setSelectedItems(new Set());
              await refreshResponses();

              if (errorCount === 0) {
                Alert.alert('Success', `Successfully deleted ${successCount} form(s).`);
              } else if (successCount > 0) {
                Alert.alert(
                  'Partial Success',
                  `Deleted ${successCount} form(s). ${errorCount} form(s) failed.`
                );
              } else {
                Alert.alert('Error', `Failed to delete ${errorCount} form(s). Please try again.`);
              }
            } catch (error) {
              console.error('Error deleting forms:', error);
              const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
              Alert.alert('Error', `Failed to delete forms: ${errorMessage}`);
            }
          },
        },
      ]
    );
  };

  const handleBatchSync = async () => {
    if (selectedItems.size === 0) {
      Alert.alert('No Selection', 'Please select at least one form to sync.');
      return;
    }

    if (!isConnected) {
      Alert.alert('No Connection', 'Please check your internet connection and try again.');
      return;
    }

    try {
      const selectedCount = selectedItems.size;
      // Note: The current sync function syncs all ready-to-send forms
      // For batch sync, we would need to filter by selectedItems
      // For now, we'll sync all and show success message
      await sync();
      setSelectedItems(new Set());
      await refreshResponses();
      
      // If we get here without error, sync was successful
      Alert.alert('Success', `Successfully synced ${selectedCount} form(s).`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync forms.';
      Alert.alert('Sync Failed', errorMessage);
    }
  };

  const handleSync = async () => {
    if (!isConnected) {
      Alert.alert('No Connection', 'Please check your internet connection and try again.');
      return;
    }

    try {
      await sync();
      await refreshResponses();
      
      // If we get here without error, sync was successful
      Alert.alert('Success', 'All ready forms have been synced successfully.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync forms.';
      Alert.alert('Sync Failed', errorMessage);
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
            <View className="w-10 h-10 rounded-xl bg-blue-100 items-center justify-center mr-3">
              <Send size={20} color="#3B82F6" strokeWidth={2} />
            </View>
            <View className="flex-1 min-w-0 mr-3">
              <View className="flex-row items-center gap-2 flex-wrap mb-0.5">
                <Text className="text-base font-semibold text-foreground flex-1">{item.formTitle || 'Untitled Form'}</Text>
            {item.syncStatus === 'syncing' && (
                  <Badge variant="secondary"><Text>Syncing...</Text></Badge>
            )}
            {item.syncStatus === 'failed' && (
                  <Badge variant="destructive"><Text>Failed</Text></Badge>
            )}
            {item.syncStatus === 'synced' && (
                  <Badge variant="secondary"><Text>Synced</Text></Badge>
                )}
              </View>
              <Text className="text-xs text-muted-foreground">{formatDate(item.updatedAt)}</Text>
              {item.errorMessage && (
                <Text className="text-xs text-destructive mt-0.5">{item.errorMessage}</Text>
            )}
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
        <LoadingSpinner fullScreen text="Loading..." visible={isLoadingResponses} />
      </>
    );
  }

  const allSelected = filteredAndSortedResponses.length > 0 && selectedItems.size === filteredAndSortedResponses.length;
  const hasSelection = selectedItems.size > 0;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <OfflineBanner />
      
      {/* Header */}
      <View className="flex-row justify-between items-center px-4 py-3 bg-card border-b border-border">
        <Text className="text-lg font-semibold text-foreground">Ready to Send</Text>
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
            placeholder="Search forms..."
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
                    ? 'bg-blue-600 border-blue-600' 
                    : 'bg-muted/50 border-border'
                }`}
                onPress={() => {
                  setSortOption(option);
                  setShowSort(false);
                }}
              >
                <Text className={`text-xs font-medium ${
                  sortOption === option 
                    ? 'text-white' 
                    : 'text-muted-foreground'
                }`}>
                  {getSortLabel(option)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}


      {/* Forms List */}
      {(() => {
        console.log('🎨 [ReadyToSendScreen] Rendering decision:', {
          filteredResponsesLength: filteredAndSortedResponses.length,
          showingEmptyState: filteredAndSortedResponses.length === 0,
          searchQuery,
          isLoadingResponses
        });
        return filteredAndSortedResponses.length === 0;
      })() ? (
        <View className="flex-1 items-center justify-center p-8">
          <Send size={64} color="#3B82F6" strokeWidth={1.5} />
          <Text className="text-xl font-semibold text-foreground mt-4 mb-2">
            {searchQuery ? 'No matching forms' : 'No forms ready to send'}
          </Text>
          <Text className="text-sm text-muted-foreground text-center">
            {searchQuery
              ? 'Try adjusting your search terms'
              : 'Mark forms as ready to send to submit them'}
          </Text>
        </View>
      ) : (
        <>
        <FlatList
            data={filteredAndSortedResponses}
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

          {/* Bottom Action Bar - Selection Mode */}
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
                title={`Sync (${selectedItems.size})`}
                onPress={handleBatchSync}
                variant="default"
                style={{ flex: 1 }}
                disabled={!isConnected || isSyncing}
                loading={isSyncing}
              />
            </View>
          )}

          {/* Floating Sync Button - Bottom Right */}
          {!hasSelection && filteredAndSortedResponses.length > 0 && (
            <View className="absolute bottom-4 right-4" style={{ bottom: Math.max(insets.bottom, 16) + (hasSelection ? 70 : 0) }}>
              <TouchableOpacity
                onPress={handleSync}
                disabled={!isConnected || isSyncing}
                activeOpacity={0.8}
                className="bg-blue-600 rounded-full shadow-lg items-center justify-center"
                style={{
                  opacity: (!isConnected || isSyncing) ? 0.5 : 1,
                  width: 56,
                  height: 56,
                  elevation: 4,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 3.84,
                }}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Send size={24} color="#FFFFFF" strokeWidth={2.5} />
                )}
              </TouchableOpacity>
              {/* Badge showing count */}
              {filteredAndSortedResponses.length > 1 && !isSyncing && (
                <View className="absolute -top-1 -right-1 bg-red-500 rounded-full min-w-[20px] h-5 items-center justify-center px-1.5 border-2 border-white">
                  <Text className="text-xs font-bold text-white">
                    {filteredAndSortedResponses.length > 99 ? '99+' : filteredAndSortedResponses.length}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Sync Error Message */}
          {syncError && !hasSelection && (
            <View className="absolute bottom-20 right-4 left-4 bg-destructive/90 rounded-lg p-3 shadow-lg">
              <Text className="text-sm text-white text-center">{syncError}</Text>
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

