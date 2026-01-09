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
import { WifiOff, ClipboardList, FileText, Filter, Search, ChevronRight, Download } from 'lucide-react-native';
import { Button } from '@/components/ui';
import { Card, CardContent } from '@/components/ui';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Checkbox } from '@/components/ui/Checkbox';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { useForm } from '@/contexts/FormContext';
import { useNetwork } from '@/contexts/NetworkContext';
import { Form } from '@/types/forms';
import { config } from '@/config/env';

type SortOption = 'newest' | 'oldest' | 'title-asc' | 'title-desc';
type FilterOption = 'all' | 'downloaded' | 'not-downloaded';

export default function DownloadFormScreen() {
  const { downloadForm, downloadedForms, fetchAccessibleForms, isLoadingForms } = useForm();
  const { isConnected } = useNetwork();
  const insets = useSafeAreaInsets();
  const [formsByProject, setFormsByProject] = useState<Record<string, { project: { id: string; name: string }; forms: Form[] }>>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingSuccess, setLoadingSuccess] = useState(false);
  const [selectedForms, setSelectedForms] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [filterOption, setFilterOption] = useState<FilterOption>('all');
  const [showSearch, setShowSearch] = useState(false);
  const [showSort, setShowSort] = useState(false);

  // Flatten all forms from all projects into a single array
  const allForms: (Form & { projectName: string })[] = Object.values(formsByProject).flatMap(
    (projectData) =>
      projectData.forms.map((form) => ({
        ...form,
        projectName: projectData.project.name,
      }))
  );

  // Search function - searches in form title, description, and project name
  const searchInForm = (form: Form & { projectName: string }, query: string): boolean => {
    const lowerQuery = query.toLowerCase();
    
    if (form.title?.toLowerCase().includes(lowerQuery)) return true;
    if (form.description?.toLowerCase().includes(lowerQuery)) return true;
    if (form.projectName?.toLowerCase().includes(lowerQuery)) return true;
    
    return false;
  };

  const isFormDownloaded = (formId: string) => {
    return downloadedForms.some((df) => df.formId === formId);
  };

  // Filter, search, and sort forms
  const filteredAndSortedForms = useMemo(() => {
    let filtered = allForms;
    
    // Apply filter (downloaded/not downloaded)
    if (filterOption === 'downloaded') {
      filtered = filtered.filter(form => isFormDownloaded(form.id));
    } else if (filterOption === 'not-downloaded') {
      filtered = filtered.filter(form => !isFormDownloaded(form.id));
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(form => searchInForm(form, searchQuery));
    }
    
    // Apply sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'newest':
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case 'oldest':
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'title-desc':
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    });
    
    return sorted;
  }, [allForms, searchQuery, sortOption, filterOption, downloadedForms]);

  // Check if all selectable (non-downloaded) forms are selected - must be before renderFormItem
  const selectableForms = allForms.filter(form => !isFormDownloaded(form.id));
  // TEST MODE: "all selected" means 1 form is selected
  const allSelected = config.TEST_MODE 
    ? selectedForms.size === 1
    : selectableForms.length > 0 && selectedForms.size === selectableForms.length;
  const hasSelection = selectedForms.size > 0;

  useEffect(() => {
    if (isConnected) {
      loadForms();
    }
  }, [isConnected]);

  const loadForms = async () => {
    if (!isConnected) {
      Alert.alert('No Connection', 'Please check your internet connection to download forms.');
      return;
    }

    setLoading(true);
    setLoadingSuccess(false);
    try {
      const forms = await fetchAccessibleForms();
      setFormsByProject(forms);
      // Clear selections when forms are reloaded
      setSelectedForms(new Set());
      // Show success animation
      setLoading(false);
      setLoadingSuccess(true);
      setTimeout(() => {
        setLoadingSuccess(false);
      }, 1200);
    } catch (error) {
      console.error('Error loading forms:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Error', `Failed to load forms: ${errorMessage}`);
      setLoading(false);
      setLoadingSuccess(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadForms();
    setRefreshing(false);
  };

  const handleSelectAll = () => {
    // Get all non-downloaded forms (for selection)
    const selectableForms = allForms.filter(form => !isFormDownloaded(form.id));
    
    // TEST MODE: Limit selection to 1 form
    if (config.TEST_MODE) {
      // Check if there's already 1 downloaded form
      const downloadedCount = downloadedForms.length;
      if (downloadedCount >= 1) {
        Alert.alert(
          'Test Mode',
          'App is in Test Mode. You can only download 1 form total. Please delete the existing downloaded form before selecting another one.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      if (selectedForms.size === 1) {
        // Deselect
        setSelectedForms(new Set());
      } else {
        // Select only the first selectable form
        const firstForm = selectableForms[0];
        if (firstForm) {
          setSelectedForms(new Set([firstForm.id]));
        }
      }
      return;
    }
    
    if (selectedForms.size === selectableForms.length) {
      // Deselect all
      setSelectedForms(new Set());
    } else {
      // Select all selectable forms (not just filtered ones)
      setSelectedForms(new Set(selectableForms.map((form) => form.id)));
    }
  };

  const handleToggleForm = (formId: string) => {
    const newSelected = new Set(selectedForms);
    if (newSelected.has(formId)) {
      newSelected.delete(formId);
    } else {
      // TEST MODE: Check if there's already 1 downloaded form
      if (config.TEST_MODE) {
        const downloadedCount = downloadedForms.length;
        if (downloadedCount >= 1) {
          Alert.alert(
            'Test Mode',
            'App is in Test Mode. You can only download 1 form total. Please delete the existing downloaded form before selecting another one.',
            [{ text: 'OK' }]
          );
          return;
        }
        
        // TEST MODE: Only allow 1 form to be selected at a time
        if (newSelected.size >= 1) {
          Alert.alert(
            'Test Mode',
            'App is in Test Mode. You can only select 1 form at a time. Please deselect the current form first.',
            [{ text: 'OK' }]
          );
          return;
        }
      }
      newSelected.add(formId);
    }
    setSelectedForms(newSelected);
  };

  const handleDownloadForm = async (form: Form & { projectName: string }) => {
    // TEST MODE: Check if there's already 1 downloaded form
    if (config.TEST_MODE) {
      const downloadedCount = downloadedForms.length;
      if (downloadedCount >= 1) {
        Alert.alert(
          'Test Mode',
          'App is in Test Mode. You can only download 1 form total. Please delete the existing downloaded form before downloading another one.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    try {
      await downloadForm(form, form.projectName);
      Alert.alert('Success', `Successfully downloaded "${form.title}".`);
    } catch (error) {
      console.error(`Error downloading form ${form.title}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Error', `Failed to download "${form.title}": ${errorMessage}`);
    }
  };

  const handleGetSelected = async () => {
    if (selectedForms.size === 0) {
      Alert.alert('No Selection', 'Please select at least one form to download.');
      return;
    }

    // TEST MODE: Check if there's already 1 downloaded form
    if (config.TEST_MODE) {
      const downloadedCount = downloadedForms.length;
      if (downloadedCount >= 1) {
        Alert.alert(
          'Test Mode',
          'App is in Test Mode. You can only download 1 form total. Please delete the existing downloaded form before downloading another one.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // TEST MODE: Limit downloads to 1 form
      if (selectedForms.size > 1) {
        Alert.alert(
          'Test Mode',
          'App is in Test Mode. You can only download 1 form at a time. Please select only one form.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    try {
      let successCount = 0;
      let errorCount = 0;

      // TEST MODE: Only process the first selected form
      const formsToDownload = config.TEST_MODE 
        ? Array.from(selectedForms).slice(0, 1)
        : Array.from(selectedForms);

      for (const formId of formsToDownload) {
        const form = filteredAndSortedForms.find((f) => f.id === formId);
        if (form) {
          try {
            const isDownloaded = downloadedForms.some((df) => df.formId === form.id);
            if (!isDownloaded) {
              await downloadForm(form, form.projectName);
              successCount++;
            }
          } catch (error) {
            console.error(`Error downloading form ${form.title}:`, error);
            errorCount++;
          }
        }
      }

      setSelectedForms(new Set());
      
      if (errorCount === 0) {
        Alert.alert('Success', `Successfully downloaded ${successCount} form(s).`);
      } else if (successCount > 0) {
        Alert.alert(
          'Partial Success',
          `Downloaded ${successCount} form(s). ${errorCount} form(s) failed.`
        );
      } else {
        Alert.alert('Error', `Failed to download ${errorCount} form(s). Please try again.`);
      }
    } catch (error) {
      console.error('Error downloading selected forms:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Error', `Failed to download forms: ${errorMessage}`);
    }
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

  const getFilterLabel = (option: FilterOption) => {
    switch (option) {
      case 'all':
        return 'All Forms';
      case 'downloaded':
        return 'Downloaded';
      case 'not-downloaded':
        return 'Not Downloaded';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch {
      return dateString;
    }
  };

  const renderFormItem = ({ item: form }: { item: Form & { projectName: string } }) => {
    const downloaded = isFormDownloaded(form.id);
    const isSelected = selectedForms.has(form.id);

    return (
      <TouchableOpacity
        onPress={() => {
          if (hasSelection && !downloaded) {
            handleToggleForm(form.id);
          }
        }}
        onLongPress={() => {
          if (!downloaded) {
            handleToggleForm(form.id);
          }
        }}
        activeOpacity={0.7}
        disabled={downloaded}
      >
        <Card className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden mb-3 mx-4">
          <CardContent className="flex-row items-center py-3 px-3">
            {hasSelection && !downloaded && (
              <View className="mr-3">
                <Checkbox checked={isSelected} onPress={() => handleToggleForm(form.id)} />
              </View>
            )}
            <View className="w-10 h-10 rounded-xl bg-purple-100 items-center justify-center mr-3">
              <FileText size={20} color="#8B5CF6" strokeWidth={2} />
            </View>
            
            <View className="flex-1 min-w-0 mr-3">
              <Text className="text-base font-semibold text-foreground">{form.title}</Text>
              <Text className="text-xs text-muted-foreground mt-0.5">
                {form.projectName}
              </Text>
              <View className="flex-row items-center mt-0.5">
                <Text className="text-xs text-muted-foreground">
                  Version {form.version}
                </Text>
                {form.createdAt && (
                  <>
                    <Text className="text-xs text-muted-foreground mx-1">•</Text>
                    <Text className="text-xs text-muted-foreground">
                      {formatDate(form.createdAt)}
                    </Text>
                  </>
            )}
          </View>
            </View>
            {downloaded ? (
              <View className="ml-2">
                <View className="bg-green-100 px-2 py-1 rounded-md">
                  <Text className="text-xs text-green-700 font-semibold">Downloaded</Text>
                </View>
              </View>
            ) : !hasSelection ? (
              <TouchableOpacity
                className="ml-2 p-2"
                onPress={() => handleDownloadForm(form)}
                activeOpacity={0.7}
              >
                <Download size={18} color="#8B5CF6" strokeWidth={2} />
              </TouchableOpacity>
            ) : null}
          </CardContent>
      </Card>
      </TouchableOpacity>
  );
  };

  if ((loading && allForms.length === 0) || loadingSuccess) {
    return (
      <>
        <View className="flex-1 bg-background" style={{ paddingTop: insets.top }} />
        <LoadingSpinner 
          fullScreen 
          text={loadingSuccess ? "Loaded successfully!" : "Loading forms..."} 
          visible={loading || loadingSuccess} 
          success={loadingSuccess}
          onSuccessComplete={() => setLoadingSuccess(false)}
        />
      </>
    );
  }

  if (!isConnected) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <OfflineBanner />
        <View className="flex-1 items-center justify-center p-8">
          <WifiOff size={64} color="#EF4444" strokeWidth={1.5} />
          <Text className="text-xl font-semibold text-foreground mt-4 mb-2">No Connection</Text>
          <Text className="text-sm text-muted-foreground text-center">
            Please check your internet connection to download forms
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <OfflineBanner />
      
      {/* Header */}
      <View className="flex-row justify-between items-center px-4 py-3 bg-card border-b border-border">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground">Download form</Text>
          {config.TEST_MODE && (
            <Text className="text-xs text-orange-600 font-medium mt-0.5">
              TEST MODE: Limited to 1 form
            </Text>
          )}
        </View>
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

      {/* Sort and Filter Options */}
      {showSort && (
        <View className="px-4 py-3 bg-card border-b border-border">
          <Text className="text-sm font-semibold text-foreground mb-2">Sort by:</Text>
          <View className="flex-row flex-wrap gap-2">
            {(['newest', 'oldest', 'title-asc', 'title-desc'] as SortOption[]).map((option) => (
              <TouchableOpacity
                key={option}
                className={`px-3 py-1.5 rounded-lg border ${
                  sortOption === option 
                    ? 'bg-purple-600 border-purple-600' 
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
          <Text className="text-sm font-semibold text-foreground mb-2 mt-3">Filter by:</Text>
          <View className="flex-row flex-wrap gap-2">
            {(['all', 'not-downloaded', 'downloaded'] as FilterOption[]).map((option) => (
              <TouchableOpacity
                key={option}
                className={`px-3 py-1.5 rounded-lg border ${
                  filterOption === option 
                    ? 'bg-purple-600 border-purple-600' 
                    : 'bg-muted/50 border-border'
                }`}
                onPress={() => {
                  setFilterOption(option);
                  setShowSort(false);
                }}
              >
                <Text className={`text-xs font-medium ${
                  filterOption === option 
                    ? 'text-white' 
                    : 'text-muted-foreground'
                }`}>
                  {getFilterLabel(option)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Form List */}
      {filteredAndSortedForms.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <ClipboardList size={64} color="#6B7280" strokeWidth={1.5} />
          <Text className="text-xl font-semibold text-foreground mt-4 mb-2">
            {searchQuery || filterOption !== 'all' ? 'No matching forms' : 'No forms available'}
          </Text>
          <Text className="text-sm text-muted-foreground text-center mb-6 px-8">
            {searchQuery || filterOption !== 'all'
              ? 'Try adjusting your search or filter criteria'
              : 'There are no forms available to download at this time'}
          </Text>
          <Button
            title="Refresh"
            onPress={loadForms}
            variant="outline"
            style={{ minWidth: 120 }}
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
              paddingBottom: Math.max(insets.bottom, 16) + 60 + 70 // Tab bar (~60px) + bottom action bar (~70px)
            }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            className="flex-1"
          />

          {/* Bottom Action Bar */}
          <View className="flex-row px-4 pt-3 bg-card border-t border-border gap-2" style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
            <Button
              title={config.TEST_MODE 
                ? (selectedForms.size === 1 ? 'Deselect' : 'Select One')
                : (allSelected ? 'Deselect All' : 'Select All')
              }
              onPress={handleSelectAll}
              variant="outline"
              style={{ flex: 1 }}
            />
            <Button
              title="Refresh"
              onPress={loadForms}
              variant="outline"
              style={{ flex: 1 }}
            />
            <Button
              title={`Get Selected (${selectedForms.size})`}
              onPress={handleGetSelected}
              variant="default"
              style={{ flex: 1 }}
              disabled={!hasSelection}
        />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Styles removed - using Tailwind CSS classes for theme support
});
