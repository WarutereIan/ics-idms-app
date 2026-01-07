import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash2, Filter, Search, ChevronRight, FileText } from 'lucide-react-native';
import { Card, CardContent } from '@/components/ui';
import { Button } from '@/components/ui';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui';
import { Checkbox } from '@/components/ui/Checkbox';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { useForm } from '@/contexts/FormContext';
import { DownloadedForm } from '@/types/forms';

type SortOption = 'newest' | 'oldest' | 'title-asc' | 'title-desc';
type FilterOption = 'all' | 'project';

interface FormWithProject extends DownloadedForm {
  projectName: string;
}

export default function DeleteFormScreen() {
  const insets = useSafeAreaInsets();
  const { downloadedForms, deleteForm, refreshDownloadedForms, responseCounts } = useForm();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedForms, setSelectedForms] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [filterOption, setFilterOption] = useState<FilterOption>('all');
  const [showSearch, setShowSearch] = useState(false);
  const [showSort, setShowSort] = useState(false);

  // Flatten all downloaded forms with project names
  const allForms: FormWithProject[] = downloadedForms.map((form) => ({
    ...form,
    projectName: form.projectName || 'Unknown Project',
  }));

  // Search function - searches in form title, description, and project name
  const searchInForm = (form: FormWithProject, query: string): boolean => {
    const lowerQuery = query.toLowerCase();
    
    if (form.title?.toLowerCase().includes(lowerQuery)) return true;
    if (form.description?.toLowerCase().includes(lowerQuery)) return true;
    if (form.projectName?.toLowerCase().includes(lowerQuery)) return true;
    
    return false;
  };

  // Filter, search, and sort forms
  const filteredAndSortedForms = useMemo(() => {
    let filtered = allForms;
    
    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(form => searchInForm(form, searchQuery));
    }
    
    // Apply sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'newest':
          return new Date(b.downloadedAt || 0).getTime() - new Date(a.downloadedAt || 0).getTime();
        case 'oldest':
          return new Date(a.downloadedAt || 0).getTime() - new Date(b.downloadedAt || 0).getTime();
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'title-desc':
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    });
    
    return sorted;
  }, [allForms, searchQuery, sortOption]);

  const allSelected = filteredAndSortedForms.length > 0 && selectedForms.size === filteredAndSortedForms.length;
  const hasSelection = selectedForms.size > 0;

  useEffect(() => {
    refreshDownloadedForms();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshDownloadedForms();
    setRefreshing(false);
  };

  const handleSelectAll = () => {
    if (selectedForms.size === filteredAndSortedForms.length) {
      setSelectedForms(new Set());
    } else {
      setSelectedForms(new Set(filteredAndSortedForms.map((form) => form.id)));
    }
  };

  const handleToggleForm = (formId: string) => {
    const newSelected = new Set(selectedForms);
    if (newSelected.has(formId)) {
      newSelected.delete(formId);
    } else {
      newSelected.add(formId);
    }
    setSelectedForms(newSelected);
  };

  const handleDeleteForm = async (form: DownloadedForm) => {
    // Count associated responses
    const draftCount = responseCounts.drafts; // Would need to filter by formId in real implementation
    const readyCount = responseCounts.readyToSend;
    const sentCount = responseCounts.sent;
    const totalResponses = draftCount + readyCount + sentCount; // Simplified - should filter by formId

    const message = totalResponses > 0
      ? `This will delete the form and all ${totalResponses} associated response${totalResponses > 1 ? 's' : ''} (drafts, ready to send, and sent). This action cannot be undone.`
      : 'This will delete the form from your device. This action cannot be undone.';

    Alert.alert(
      'Delete Form',
      message,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteForm(form.formId);
              Alert.alert('Success', 'Form deleted successfully');
            } catch (error) {
              console.error('Error deleting form:', error);
              Alert.alert('Error', 'Failed to delete form. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleBatchDelete = async () => {
    if (selectedForms.size === 0) {
      Alert.alert('No Selection', 'Please select at least one form to delete.');
      return;
    }

    const selectedCount = selectedForms.size;
    Alert.alert(
      'Delete Selected Forms',
      `This will delete ${selectedCount} form${selectedCount > 1 ? 's' : ''} and all associated responses from your device. This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              let successCount = 0;
              let errorCount = 0;

              for (const formId of selectedForms) {
                const form = filteredAndSortedForms.find((f) => f.id === formId);
                if (form) {
                  try {
                    await deleteForm(form.formId);
                    successCount++;
                  } catch (error) {
                    console.error(`Error deleting form ${form.title}:`, error);
                    errorCount++;
                  }
                }
              }

              setSelectedForms(new Set());
              
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
              console.error('Error deleting selected forms:', error);
              const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
              Alert.alert('Error', `Failed to delete forms: ${errorMessage}`);
            }
          },
        },
      ]
    );
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

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderFormItem = ({ item: form }: { item: FormWithProject }) => {
    const isSelected = selectedForms.has(form.id);

    return (
      <TouchableOpacity
        onPress={() => {
          if (hasSelection) {
            handleToggleForm(form.id);
          }
        }}
        onLongPress={() => handleToggleForm(form.id)}
        activeOpacity={0.7}
      >
        <Card className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden mb-3 mx-4">
          <CardContent className="flex-row items-center py-3 px-3">
            {hasSelection && (
              <View className="mr-3">
                <Checkbox checked={isSelected} onPress={() => handleToggleForm(form.id)} />
              </View>
            )}
            <View className="w-10 h-10 rounded-xl bg-red-100 items-center justify-center mr-3">
              <FileText size={20} color="#EF4444" strokeWidth={2} />
            </View>
            
            <View className="flex-1 min-w-0 mr-3">
              <Text className="text-base font-semibold text-foreground">{form.title}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">
                {form.projectName}
              </Text>
              {form.description && (
                <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={2}>
                  {form.description}
                </Text>
              )}
              <View className="flex-row items-center mt-0.5">
                <Text className="text-xs text-muted-foreground">
                  Version {form.version} • Downloaded {formatDate(form.downloadedAt)}
                </Text>
              </View>
            </View>
            {!hasSelection && (
              <TouchableOpacity
                className="ml-2 p-2"
                onPress={() => handleDeleteForm(form)}
                activeOpacity={0.7}
              >
                <Trash2 size={18} color="#EF4444" strokeWidth={2} />
              </TouchableOpacity>
            )}
          </CardContent>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <OfflineBanner />
      
      {/* Header */}
      <View className="flex-row justify-between items-center px-4 py-3 bg-card border-b border-border">
        <Text className="text-lg font-semibold text-foreground">Delete forms</Text>
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
                    ? 'bg-red-600 border-red-600' 
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

      {/* Form List */}
      {filteredAndSortedForms.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <Trash2 size={64} color="#EF4444" strokeWidth={1.5} />
          <Text className="text-xl font-semibold text-foreground mt-4 mb-2">
            {searchQuery ? 'No matching forms' : 'No downloaded forms'}
          </Text>
          <Text className="text-sm text-muted-foreground text-center mb-6">
            {searchQuery 
              ? 'Try adjusting your search criteria' 
              : 'Download forms to see them here'
            }
          </Text>
          <Button
            title="Refresh"
            onPress={onRefresh}
            variant="outline"
          />
        </View>
      ) : (
        <>
          <FlatList
            data={filteredAndSortedForms}
            renderItem={renderFormItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingTop: 8,
              paddingBottom: Math.max(insets.bottom, 16) + 60 + (hasSelection ? 70 : 0)
            }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            className="flex-1"
          />

          {/* Bottom Action Bar */}
          {hasSelection && (
            <View className="flex-row px-4 pt-3 bg-card border-t border-border gap-2" style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
              <Button
                title={allSelected ? 'Deselect All' : 'Select All'}
                onPress={handleSelectAll}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                title={`Delete Selected (${selectedForms.size})`}
                onPress={handleBatchDelete}
                variant="destructive"
                style={{ flex: 1 }}
                disabled={!hasSelection}
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

