/**
 * Sample Photo Generation Utilities
 * Generates sample photos for template previews
 */

import { Photo } from '../types';

// Removed placeholder photo generation functions since we now only use actual client folder photos

/**
 * Check if we should use sample photos for a template
 */
export function shouldUseSamplePhotos(
  isPreviewMode: boolean,
  hasAssignedPhotos: boolean
): boolean {
  return isPreviewMode && !hasAssignedPhotos;
}

/**
 * Get optimized photo URL for preview (smaller size for performance)
 */
function getOptimizedPhotoUrl(photo: Photo, size: string = 's300'): string {
  let optimizedUrl = '';
  let method = '';

  // Try to use Google Drive ID for optimized URL
  if (photo.googleDriveId) {
    optimizedUrl = `https://lh3.googleusercontent.com/d/${photo.googleDriveId}=${size}`;
    method = 'googleDriveId';
  }
  // Try to extract file ID from existing URL and optimize
  else if (photo.url) {
    const fileIdMatch = photo.url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (fileIdMatch) {
      optimizedUrl = `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}=${size}`;
      method = 'extractedFromUrl';
    }
  }
  // Fallback to thumbnail URL with size adjustment
  if (!optimizedUrl && photo.thumbnailUrl) {
    optimizedUrl = photo.thumbnailUrl.replace(/=s\d+/, `=${size}`);
    method = 'thumbnailAdjusted';
  }
  
  // Last resort: use original URL
  if (!optimizedUrl) {
    optimizedUrl = photo.url || '';
    method = 'originalUrl';
  }

  console.log(`🔗 Optimized photo URL for ${photo.name}:`, {
    method,
    size,
    originalUrl: photo.url?.substring(0, 60) + '...',
    optimizedUrl: optimizedUrl.substring(0, 60) + '...',
    googleDriveId: photo.googleDriveId
  });

  return optimizedUrl;
}

/**
 * Get sample photos for a specific template using actual client folder photos
 */
export function getSamplePhotosForTemplate(
  availablePhotos: Photo[],
  templateHoleCount: number,
  templateId: string
): Photo[] {
  const samplePhotos: Photo[] = [];
  
  // Only proceed if we have actual photos from the client folder
  if (availablePhotos.length === 0 || templateHoleCount === 0) {
    console.log(`⚠️ No photos available for template ${templateId} or no holes to fill`);
    return samplePhotos;
  }
  
  // Use template ID to ensure consistent sample photos for the same template
  const seedValue = templateId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  console.log(`📸 Auto-filling template ${templateId} with ${templateHoleCount} photos from ${availablePhotos.length} available`);
  
  // Create a shuffled array of photo indices for better distribution
  const shuffledIndices: number[] = [];
  for (let i = 0; i < availablePhotos.length; i++) {
    shuffledIndices.push(i);
  }
  
  // Shuffle using the seed for consistency
  for (let i = shuffledIndices.length - 1; i > 0; i--) {
    const j = (seedValue + i) % (i + 1);
    [shuffledIndices[i], shuffledIndices[j]] = [shuffledIndices[j], shuffledIndices[i]];
  }

  for (let i = 0; i < templateHoleCount; i++) {
    // Use shuffled index for better photo variety
    const photoIndex = shuffledIndices[i % shuffledIndices.length];
    const originalPhoto = availablePhotos[photoIndex];
    
    console.log(`📸 Assigning photo ${i + 1}/${templateHoleCount} for template ${templateId}:`, {
      slotIndex: i,
      photoIndex,
      photoName: originalPhoto.name,
      photoId: originalPhoto.id
    });
    
    // Create optimized version of the photo for preview
    const optimizedPhoto: Photo = {
      ...originalPhoto,
      id: `preview-${templateId}-${i}`,
      name: `Preview ${i + 1}`,
      url: getOptimizedPhotoUrl(originalPhoto, 's300'), // Smaller size for preview
      thumbnailUrl: getOptimizedPhotoUrl(originalPhoto, 's200') // Even smaller thumbnail
    };
    
    samplePhotos.push(optimizedPhoto);
  }
  
  console.log(`✅ Generated ${samplePhotos.length} optimized preview photos for template ${templateId}`);
  return samplePhotos;
}