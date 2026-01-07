import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert, ScrollView, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { BaseQuestionRenderer, BaseQuestionRendererProps } from './BaseQuestionRenderer';
import { MediaUploadQuestion } from '@/types/forms';
import { saveMediaAttachment, getMediaAttachmentsByResponse } from '@/services/offlineStorage';
import { generateUUID } from '@/lib/utils';

interface MediaUploadQuestionRendererProps extends Omit<BaseQuestionRendererProps, 'children'> {
  question: MediaUploadQuestion;
  responseId?: string;
}

interface MediaFile {
  id: string;
  uri: string;
  type: 'image' | 'video' | 'file';
  name: string;
  size?: number;
}

export function MediaUploadQuestionRenderer({
  question,
  value,
  onChange,
  error,
  isPreviewMode,
  responseId,
}: MediaUploadQuestionRendererProps) {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load existing media attachments
  useEffect(() => {
    if (responseId && question.id) {
      loadMediaAttachments();
    } else if (value) {
      // Fallback: load from value if responseId not available
      try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        if (Array.isArray(parsed)) {
          setMediaFiles(parsed);
        }
      } catch (e) {
        console.error('Error parsing media value:', e);
      }
    }
  }, [responseId, question.id, value]);

  const loadMediaAttachments = async () => {
    if (!responseId || !question.id) return;

    try {
      const attachments = await getMediaAttachmentsByResponse(responseId);
      const questionAttachments = attachments.filter(a => a.questionId === question.id);
      
      const files: MediaFile[] = questionAttachments.map(att => ({
        id: att.id,
        uri: att.filePath,
        type: att.fileType.startsWith('image/') ? 'image' : att.fileType.startsWith('video/') ? 'video' : 'file',
        name: att.fileName,
        size: att.fileSize,
      }));
      
      setMediaFiles(files);
      onChange?.(JSON.stringify(files));
    } catch (error) {
      console.error('Error loading media attachments:', error);
    }
  };

  const requestMediaPermissions = async (type: 'image' | 'video' | 'camera'): Promise<boolean> => {
    if (type === 'camera' || type === 'image') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Camera permission is required to take photos.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }

    if (type === 'video' || type === 'image') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Media library permission is required to select files.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }

    return true;
  };

  const handleImagePicker = async (source: 'camera' | 'library') => {
    if (isPreviewMode) return;

    try {
      setIsLoading(true);

      const hasPermission = await requestMediaPermissions(source === 'camera' ? 'camera' : 'image');
      if (!hasPermission) {
        setIsLoading(false);
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: question.allowEditing !== false,
        quality: question.imageQuality || 0.8,
        allowsMultipleSelection: (question.maxFiles || 1) > 1,
      };

      let result;
      if (source === 'camera') {
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets) {
        await handleMediaSelection(result.assets.map((asset, index) => ({
          id: `${Date.now()}_${index}`,
          uri: asset.uri,
          type: 'image' as const,
          name: asset.fileName || `image_${Date.now()}_${index}.jpg`,
          size: asset.fileSize,
        })));
      }
    } catch (error: any) {
      console.error('Error picking image:', error);
      Alert.alert('Error', error.message || 'Failed to pick image. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVideoPicker = async () => {
    if (isPreviewMode) return;

    try {
      setIsLoading(true);

      const hasPermission = await requestMediaPermissions('video');
      if (!hasPermission) {
        setIsLoading(false);
        return;
      }

      const maxFiles = question.maxFiles || 1;
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: question.allowEditing !== false,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
        allowsMultipleSelection: maxFiles > 1,
      };

      const result = await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets) {
        await handleMediaSelection(result.assets.map((asset, index) => ({
          id: `${Date.now()}_${index}`,
          uri: asset.uri,
          type: 'video' as const,
          name: asset.fileName || `video_${Date.now()}_${index}.mp4`,
          size: asset.fileSize,
        })));
      }
    } catch (error: any) {
      console.error('Error picking video:', error);
      Alert.alert('Error', error.message || 'Failed to pick video. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilePicker = async () => {
    if (isPreviewMode) return;

    try {
      setIsLoading(true);

      const maxFiles = (question as any).maxFiles || question.maxFiles || 1;
      const acceptedFileTypes = (question as any).acceptedFileTypes || question.acceptedFileTypes;
      const result = await DocumentPicker.getDocumentAsync({
        type: acceptedFileTypes?.join(',') || '*/*',
        multiple: maxFiles > 1,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets) {
        await handleMediaSelection(result.assets.map((asset, index) => ({
          id: `${Date.now()}_${index}`,
          uri: asset.uri,
          type: 'file' as const,
          name: asset.name,
          size: asset.size,
        })));
      }
    } catch (error: any) {
      console.error('Error picking file:', error);
      Alert.alert('Error', error.message || 'Failed to pick file. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMediaSelection = async (newFiles: MediaFile[]) => {
    const maxFiles = (question as any).maxFiles || question.maxFiles || 1;
    const currentCount = mediaFiles.length;
    const remainingSlots = maxFiles - currentCount;

    if (remainingSlots <= 0) {
      Alert.alert('Maximum Files Reached', `You can only upload ${maxFiles} file(s).`);
      return;
    }

    const filesToAdd = newFiles.slice(0, remainingSlots);
    const updatedFiles = [...mediaFiles, ...filesToAdd];

    setMediaFiles(updatedFiles);
    onChange?.(JSON.stringify(updatedFiles));

    // Save to offline storage if responseId is available
    if (responseId && question.id) {
      try {
        for (const file of filesToAdd) {
          // Generate unique ID if not present
          const attachmentId = file.id || generateUUID();
          
          await saveMediaAttachment({
            id: attachmentId,
            responseId,
            questionId: question.id,
            filePath: file.uri,
            fileName: file.name,
            fileType: file.type === 'image' ? 'image/jpeg' : file.type === 'video' ? 'video/mp4' : 'application/octet-stream',
            fileSize: file.size || 0,
            uploaded: false,
            syncStatus: 'pending',
          });
        }
      } catch (error) {
        console.error('Error saving media attachment:', error);
        Alert.alert('Error', 'Failed to save media attachment. Please try again.');
      }
    }
  };

  const removeMediaFile = (fileId: string) => {
    Alert.alert(
      'Remove File',
      'Are you sure you want to remove this file?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updatedFiles = mediaFiles.filter(f => f.id !== fileId);
            setMediaFiles(updatedFiles);
            onChange?.(updatedFiles.length > 0 ? JSON.stringify(updatedFiles) : undefined);
          },
        },
      ]
    );
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const maxFiles = (question as any).maxFiles || question.maxFiles || 1;
  const canAddMore = mediaFiles.length < maxFiles;

  return (
    <BaseQuestionRenderer
      question={question}
      error={error}
      isPreviewMode={isPreviewMode}
    >
      <View style={styles.container}>
        {/* Media Preview */}
        {mediaFiles.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaPreview}>
            {mediaFiles.map((file) => (
              <View key={file.id} style={styles.mediaItem}>
                {file.type === 'image' && (
                  <Image source={{ uri: file.uri }} style={styles.mediaImage} />
                )}
                {file.type === 'video' && (
                  <View style={styles.mediaPlaceholder}>
                    <Text style={styles.mediaIcon}>🎥</Text>
                    <Text style={styles.mediaLabel}>Video</Text>
                  </View>
                )}
                {file.type === 'file' && (
                  <View style={styles.mediaPlaceholder}>
                    <Text style={styles.mediaIcon}>📄</Text>
                    <Text style={styles.mediaLabel} numberOfLines={1}>{file.name}</Text>
                  </View>
                )}
                {file.size && (
                  <Text style={styles.mediaSize}>{formatFileSize(file.size)}</Text>
                )}
                {!isPreviewMode && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeMediaFile(file.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.removeButtonText}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
        )}

        {/* Upload Buttons */}
        {!isPreviewMode && canAddMore && (
          <View style={styles.buttonsContainer}>
            {((question as any).acceptImages !== false && (question.type === 'IMAGE_UPLOAD' || !question.type)) && (
              <>
                <TouchableOpacity
                  style={[styles.uploadButton, styles.primaryButton]}
                  onPress={() => handleImagePicker('camera')}
                  disabled={isLoading}
                  activeOpacity={0.7}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <>
                      <Text style={styles.buttonIcon}>📷</Text>
                      <Text style={styles.buttonText}>Camera</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.uploadButton, styles.secondaryButton]}
                  onPress={() => handleImagePicker('library')}
                  disabled={isLoading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.buttonIcon}>🖼️</Text>
                  <Text style={styles.buttonText}>Gallery</Text>
                </TouchableOpacity>
              </>
            )}
            {((question as any).acceptVideos && (question.type === 'VIDEO_UPLOAD' || !question.type)) && (
              <TouchableOpacity
                style={[styles.uploadButton, styles.secondaryButton]}
                onPress={handleVideoPicker}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                <Text style={styles.buttonIcon}>🎥</Text>
                <Text style={styles.buttonText}>Video</Text>
              </TouchableOpacity>
            )}
            {((question as any).acceptFiles && (question.type === 'FILE_UPLOAD' || !question.type)) && (
              <TouchableOpacity
                style={[styles.uploadButton, styles.secondaryButton]}
                onPress={handleFilePicker}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                <Text style={styles.buttonIcon}>📄</Text>
                <Text style={styles.buttonText}>File</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {mediaFiles.length >= maxFiles && (
          <Text style={styles.maxFilesText}>
            Maximum {maxFiles} file{maxFiles > 1 ? 's' : ''} reached
          </Text>
        )}
      </View>
    </BaseQuestionRenderer>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  mediaPreview: {
    marginBottom: 12,
  },
  mediaItem: {
    marginRight: 12,
    position: 'relative',
  },
  mediaImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  mediaPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  mediaIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  mediaLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  mediaSize: {
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 4,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  removeButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  buttonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 44,
    flex: 1,
    minWidth: 100,
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#10B981',
  },
  secondaryButton: {
    backgroundColor: '#6b7280',
  },
  buttonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  maxFilesText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
});

