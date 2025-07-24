/// <reference types="gapi" />
/// <reference types="gapi.client.drive-v3" />
// Updated: Google Drive service.
import { GoogleDriveFile, GoogleDriveFolder, Photo } from '../types';
import { GOOGLE_DRIVE_CONFIG, SUPPORTED_IMAGE_TYPES, ERROR_MESSAGES } from '../utils/constants';
import { logger } from './loggerService';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

class GoogleDriveService {
  private isInitialized = false;
  private accessToken: string | null = null;
  private blobUrls: Set<string> = new Set(); // Track blob URLs for cleanup

  async initialize(): Promise<boolean> {
    try {
      if (typeof window === 'undefined') return false;

      // Load Google API for client calls only
      await this.loadGoogleAPI();
      
      // Initialize gapi client only (no auth2)
      await new Promise((resolve, reject) => {
        window.gapi.load('client', {
          callback: resolve,
          onerror: reject,
        });
      });

      // Initialize the client without auth
      await window.gapi.client.init({
        apiKey: GOOGLE_DRIVE_CONFIG.apiKey,
        discoveryDocs: GOOGLE_DRIVE_CONFIG.discoveryDocs,
      });

      this.isInitialized = true;
      return true;
    } catch (error) {
      logger.drive.error('Failed to initialize Google Drive API', error);
      throw new Error(ERROR_MESSAGES.GOOGLE_DRIVE_AUTH_FAILED);
    }
  }

  private async loadGoogleAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.gapi) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google API'));
      document.head.appendChild(script);
    });
  }

  // Set access token from external auth (Google Identity Services)
  setAccessToken(token: string): void {
    this.accessToken = token;
    console.log('🔑 Access token set in GoogleDriveService:', token ? 'Token provided' : 'No token');
    if (window.gapi && window.gapi.client) {
      window.gapi.client.setToken({ access_token: token });
      console.log('🔑 Token also set in gapi.client');
    }
  }

  // Remove old auth2-based methods and replace with token-based authentication
  isSignedIn(): boolean {
    return !!this.accessToken;
  }

  // Cleanup method to revoke blob URLs and prevent memory leaks
  cleanupBlobUrls(): void {
    this.blobUrls.forEach(url => {
      URL.revokeObjectURL(url);
    });
    this.blobUrls.clear();
  }

  signOut(): void {
    this.accessToken = null;
    this.cleanupBlobUrls();
    if (window.gapi && window.gapi.client) {
      window.gapi.client.setToken(null);
    }
  }


  async getFolderContents(folderId: string): Promise<GoogleDriveFolder> {
    try {
      console.log(`📁 Getting folder contents for: ${folderId}`);
      if (!this.isSignedIn()) {
        console.error('❌ Not signed in to Google Drive');
        throw new Error(ERROR_MESSAGES.GOOGLE_DRIVE_AUTH_FAILED);
      }
      console.log('✅ Google Drive authentication verified');

      // Get folder info
      const folderResponse = await window.gapi.client.drive.files.get({
        fileId: folderId,
        fields: 'id,name',
      });

      // Get folder contents with pagination
      const files: GoogleDriveFile[] = [];
      const folders: GoogleDriveFolder[] = [];
      let pageToken;
      
      interface DriveFilesListResponse {
        result: {
          nextPageToken?: string;
          files: gapi.client.drive.File[];
        }
      }

      do {
        const filesResponse: DriveFilesListResponse = await window.gapi.client.drive.files.list({
          q: `'${folderId}' in parents and trashed=false`,
          fields: 'nextPageToken, files(id,name,mimeType,size,webContentLink,webViewLink,thumbnailLink,createdTime,modifiedTime,parents)',
          pageSize: 1000,
          orderBy: 'name',
          pageToken: pageToken,
        });

        for (const file of filesResponse.result.files || []) {
          console.log(`📄 Found file: ${file.name}`, { mimeType: file.mimeType, hasThumb: !!file.thumbnailLink });
          logger.drive.debug(`Found file: ${file.name}`, { mimeType: file.mimeType, thumbnailLink: file.thumbnailLink });
          
          if (file.mimeType === 'application/vnd.google-apps.folder') {
            folders.push({
              id: file.id || '',
              name: file.name || '',
              createdTime: file.createdTime || new Date().toISOString(),
              mimeType: file.mimeType,
              parents: file.parents,
              files: [],
              folders: [],
            });
          } else if (this.isImageFile(file.mimeType || '')) {
            console.log(`🖼️ Adding image: ${file.name}`, { 
              thumbnailLink: file.thumbnailLink,
              webContentLink: file.webContentLink,
              mimeType: file.mimeType 
            });
            logger.drive.debug(`Added as image: ${file.name}`);
            files.push({
              id: file.id || '',
              name: file.name || '',
              mimeType: file.mimeType || '',
              size: file.size || '0',
              webContentLink: file.webContentLink || '',
              webViewLink: file.webViewLink || '',
              thumbnailLink: file.thumbnailLink || '',
              createdTime: file.createdTime || '',
              modifiedTime: file.modifiedTime || '',
              parents: file.parents || [],
            });
          } else {
            logger.drive.debug(`Skipped (not image): ${file.name}`, { mimeType: file.mimeType });
          }
        }
        pageToken = filesResponse.result.nextPageToken;
      } while (pageToken);

      return {
        id: folderResponse.result.id,
        name: folderResponse.result.name,
        createdTime: folderResponse.result.createdTime || new Date().toISOString(),
        mimeType: folderResponse.result.mimeType,
        parents: folderResponse.result.parents,
        files,
        folders,
      };
    } catch (error) {
      logger.drive.error('Failed to get folder contents', error);
      throw new Error(ERROR_MESSAGES.GOOGLE_DRIVE_FOLDER_NOT_FOUND);
    }
  }

  async getPhotosFromFolder(folderId: string): Promise<Photo[]> {
    try {
      const folder = await this.getFolderContents(folderId);
      const files = folder.files || [];
      console.log(`📁 Found ${files.length} files in folder: ${folder.name}`);
      
      // Fast: Use thumbnail URLs directly
      const photos = files.map((file) => {
        let photoUrl = file.thumbnailLink || '';
        
        // Make thumbnail larger if possible
        if (file.thumbnailLink && file.thumbnailLink.includes('=s220')) {
          photoUrl = file.thumbnailLink.replace('=s220', '=s400');
        }
        
        return {
          id: file.id,
          url: photoUrl,
          thumbnailUrl: file.thumbnailLink || '',
          name: file.name,
          mimeType: file.mimeType,
          size: parseInt(file.size) || 0,
          googleDriveId: file.id,
          webContentLink: file.webContentLink,
          webViewLink: file.webViewLink,
          createdTime: file.createdTime,
          modifiedTime: file.modifiedTime,
        };
      });

      console.log(`✅ Returning ${photos.length} photos instantly`);
      return photos;
    } catch (error) {
      console.error('❌ Failed to get photos from folder:', error);
      throw error;
    }
  }

  // New method: Create blob URL on demand (for when user actually needs the photo)
  async createPhotoBlob(photoId: string): Promise<string> {
    try {
      if (!this.accessToken) {
        throw new Error('No access token available');
      }
      
      return await this.createBlobUrlForImage(photoId);
    } catch (error) {
      console.warn('Failed to create photo blob:', error);
      throw error;
    }
  }

  private async generatePhotoUrls(file: GoogleDriveFile): Promise<{
    primary: string;
    thumbnail: string;
    fallbacks: string[];
  }> {
    const urls = {
      primary: '',
      thumbnail: '',
      fallbacks: [] as string[]
    };

    // Strategy 1: Use thumbnail URLs first (fast, no download) - GitHub approach
    if (file.thumbnailLink) {
      const thumbUrl = file.thumbnailLink.replace('=s220', '=s400');
      urls.primary = thumbUrl;
      urls.thumbnail = file.thumbnailLink; // Keep original =s220 for grid
      urls.fallbacks.push(thumbUrl);
      urls.fallbacks.push(file.thumbnailLink.replace('=s220', '=s600'));
      console.log(`✅ Using thumbnail URLs for ${file.name}`);
      return urls;
    }

    // Strategy 2: Fallback to blob URL only if no thumbnails (rare case)
    try {
      if (this.accessToken) {
        const blobUrl = await this.createBlobUrlForImage(file.id);
        urls.primary = blobUrl;
        urls.thumbnail = blobUrl;
        console.log(`⚠️ Created blob URL for ${file.name} (no thumbnails available)`);
        return urls;
      }
    } catch (blobError) {
      console.warn(`Blob URL failed for ${file.name}:`, blobError);
    }

    // Strategy 3: Google Drive direct URLs (last resort)
    if (file.thumbnailLink) {
      const thumbUrl = file.thumbnailLink.replace('=s220', '=s800');
      urls.primary = thumbUrl;
      urls.thumbnail = file.thumbnailLink;
      urls.fallbacks.push(thumbUrl);
      console.log(`Using thumbnail URL for ${file.name}: ${thumbUrl}`);
    }

    // Strategy 4: Google Drive direct link
    const directUrl = `https://drive.google.com/uc?id=${file.id}&export=view`;
    urls.fallbacks.push(directUrl);

    // Strategy 5: API endpoint with token
    if (this.accessToken) {
      const apiUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&access_token=${this.accessToken}`;
      urls.fallbacks.push(apiUrl);
    }

    // If no primary URL was set, use the first fallback
    if (!urls.primary && urls.fallbacks.length > 0) {
      urls.primary = urls.fallbacks[0];
    }

    return urls;
  }

  private async createBlobUrlForImage(fileId: string): Promise<string> {
    try {
      if (!this.accessToken) {
        throw new Error('No access token available');
      }

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      this.blobUrls.add(blobUrl);
      return blobUrl;
    } catch (error) {
      console.error('Failed to create blob URL:', error);
      throw error;
    }
  }

  private convertFilesToPhotos(files: GoogleDriveFile[]): Photo[] {
    return files.map(file => ({
      id: file.id,
      url: this.getViewableImageUrl(file.id), // Use viewable URL instead of direct download
      thumbnailUrl: file.thumbnailLink || this.getThumbnailUrl(file.id),
      name: file.name,
      mimeType: file.mimeType,
      size: parseInt(file.size) || 0,
      googleDriveId: file.id,
      webContentLink: file.webContentLink,
      webViewLink: file.webViewLink,
      createdTime: file.createdTime,
      modifiedTime: file.modifiedTime,
    }));
  }

  private getDirectImageUrl(fileId: string): string {
    return `https://drive.google.com/uc?id=${fileId}&export=download`;
  }

  private getViewableImageUrl(fileId: string): string {
    return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&access_token=${this.accessToken}`;
  }

  private getThumbnailUrl(fileId: string, size: number = 400): string {
    // Use Drive API v3 thumbnail endpoint with access token
    if (this.accessToken) {
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=s${size}&access_token=${this.accessToken}`;
    }
    // Fallback to public thumbnail (may not work for private files)
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=s${size}`;
  }

  async createOutputFolder(parentFolderId: string, folderName: string): Promise<string> {
    try {
      if (!this.isSignedIn()) {
        throw new Error(ERROR_MESSAGES.GOOGLE_DRIVE_AUTH_FAILED);
      }

      const response = await window.gapi.client.drive.files.create({
        resource: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolderId],
        },
        fields: 'id',
      });

      return response.result.id;
    } catch (error) {
      console.error('Failed to create output folder:', error);
      throw new Error(ERROR_MESSAGES.EXPORT_FAILED);
    }
  }

  async uploadFile(
    file: Blob,
    fileName: string,
    parentFolderId: string,
    mimeType: string = 'image/jpeg'
  ): Promise<string> {
    try {
      if (!this.isSignedIn() || !this.accessToken) {
        throw new Error(ERROR_MESSAGES.GOOGLE_DRIVE_AUTH_FAILED);
      }

      const metadata = {
        name: fileName,
        parents: [parentFolderId],
        mimeType,
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: new Headers({
          'Authorization': `Bearer ${this.accessToken}`
        }),
        body: form,
      });

      if (!response.ok) {
        const errorBody = await response.json();
        console.error('Failed to upload file:', errorBody);
        throw new Error(`Upload failed: ${errorBody.error.message}`);
      }

      const result = await response.json();
      return result.id;
    } catch (error) {
      console.error('Failed to upload file:', error);
      throw new Error(ERROR_MESSAGES.EXPORT_FAILED);
    }
  }

  async getFileMetadata(fileId: string): Promise<any> {
    try {
      if (!this.isSignedIn()) {
        throw new Error(ERROR_MESSAGES.GOOGLE_DRIVE_AUTH_FAILED);
      }

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,permissions`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('File not found');
        } else if (response.status === 403) {
          throw new Error('Permission denied');
        } else {
          throw new Error(`Failed to get file metadata: ${response.status}`);
        }
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get file metadata:', error);
      throw error;
    }
  }

  async downloadPhoto(photoId: string): Promise<Blob> {
    try {
      if (!this.isSignedIn()) {
        throw new Error(ERROR_MESSAGES.GOOGLE_DRIVE_AUTH_FAILED);
      }

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${photoId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        console.error('Google Drive API Error:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url
        });
        
        if (response.status === 404) {
          throw new Error('File not found - please check the file ID is correct');
        } else if (response.status === 403) {
          throw new Error('Permission denied - make sure the file is shared or public');
        } else if (response.status === 401) {
          throw new Error('Authentication failed - please sign in to Google Drive again');
        } else {
          throw new Error(`Failed to download photo (${response.status}: ${response.statusText})`);
        }
      }

      return await response.blob();
    } catch (error) {
      console.error('Failed to download photo:', error);
      throw new Error(ERROR_MESSAGES.PHOTO_LOAD_FAILED);
    }
  }

  // Download PNG template files with better error handling
  async downloadTemplate(templateId: string): Promise<Blob> {
    try {
      // Validate and clean template ID first
      if (!templateId || typeof templateId !== 'string') {
        throw new Error('Invalid template ID: must be a non-empty string');
      }
      
      // Handle legacy URLs stored as template IDs (extract file ID from URL)
      let cleanFileId = templateId;
      if (templateId.includes('drive.google.com') || templateId.includes('http')) {
        console.log('🔧 Legacy URL detected, extracting file ID:', templateId);
        
        const patterns = [
          /\/file\/d\/([a-zA-Z0-9-_]+)/,  // /file/d/FILE_ID
          /id=([a-zA-Z0-9-_]+)/,          // id=FILE_ID
          /\/d\/([a-zA-Z0-9-_]+)/,        // /d/FILE_ID
        ];
        
        let extracted = false;
        for (const pattern of patterns) {
          const match = templateId.match(pattern);
          if (match && match[1]) {
            cleanFileId = match[1];
            extracted = true;
            console.log('✅ Extracted file ID from legacy URL:', cleanFileId);
            break;
          }
        }
        
        if (!extracted) {
          throw new Error(`Could not extract file ID from legacy URL: ${templateId}`);
        }
      }
      
      // Validate the clean file ID
      if (cleanFileId.length < 15 || cleanFileId.length > 100) {
        throw new Error(`Invalid template ID length: ${cleanFileId.length} characters (expected 15-100)`);
      }
      
      if (!/^[a-zA-Z0-9-_]+$/.test(cleanFileId)) {
        throw new Error(`Invalid template ID format: "${cleanFileId}" contains invalid characters`);
      }
      
      if (!this.isSignedIn()) {
        throw new Error('Not authenticated with Google Drive');
      }

      console.log(`📥 Downloading template: ${cleanFileId}${cleanFileId !== templateId ? ` (extracted from legacy URL: ${templateId})` : ''}`);
      
      // Add timeout and better error handling for network issues
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      try {
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${cleanFileId}?alt=media`,
          {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
            },
            signal: controller.signal,
          }
        );
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.error(`❌ Template download failed: ${response.status} ${response.statusText}`);
          if (response.status === 404) {
            throw new Error('Template file not found - it may have been deleted or moved');
          } else if (response.status === 403) {
            throw new Error('Permission denied - template file is not accessible');
          } else if (response.status === 401) {
            throw new Error('Authentication expired - please sign in again');
          } else {
            throw new Error(`Failed to download template: ${response.status} ${response.statusText}`);
          }
        }
        
        const blob = await response.blob();
        console.log(`✅ Template downloaded successfully: ${cleanFileId}${cleanFileId !== templateId ? ` (extracted from legacy URL: ${templateId})` : ''}`);
        return blob;
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          throw new Error('Template download timed out - please try again');
        } else if (fetchError instanceof TypeError && fetchError.message === 'Failed to fetch') {
          throw new Error('Network error - please check your internet connection and try again');
        } else {
          throw fetchError;
        }
      }
    } catch (error) {
      console.error('❌ Template download error:', error);
      throw new Error(`Template download failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getPhotoMetadata(photoId: string): Promise<any> {
    try {
      if (!this.isSignedIn()) {
        throw new Error(ERROR_MESSAGES.GOOGLE_DRIVE_AUTH_FAILED);
      }

      const response = await window.gapi.client.drive.files.get({
        fileId: photoId,
        fields: 'id,name,mimeType,size,imageMediaMetadata,createdTime,modifiedTime',
      });

      return response.result;
    } catch (error) {
      console.error('Failed to get photo metadata:', error);
      return null;
    }
  }

  private isImageFile(mimeType: string): boolean {
    const isImage = SUPPORTED_IMAGE_TYPES.indexOf(mimeType) !== -1;
    console.log(`Checking if ${mimeType} is image: ${isImage}, supported types:`, SUPPORTED_IMAGE_TYPES);
    return isImage;
  }

  async searchFiles(query: string, folderId?: string): Promise<GoogleDriveFile[]> {
    try {
      if (!this.isSignedIn()) {
        throw new Error(ERROR_MESSAGES.GOOGLE_DRIVE_AUTH_FAILED);
      }

      let queryString = `name contains '${query}' and trashed=false`;
      if (folderId) {
        queryString += ` and '${folderId}' in parents`;
      }

      const response = await window.gapi.client.drive.files.list({
        q: queryString,
        fields: 'files(id,name,mimeType,size,webContentLink,webViewLink,thumbnailLink,createdTime,modifiedTime,parents)',
        pageSize: 100,
        orderBy: 'name',
      });

             return (response.result.files || []).filter((file: any) => this.isImageFile(file.mimeType));
    } catch (error) {
      console.error('Failed to search files:', error);
      return [];
    }
  }

  async getFolderTree(folderId: string, maxDepth: number = 2): Promise<GoogleDriveFolder> {
    try {
      const folder = await this.getFolderContents(folderId);
      
      if (maxDepth > 0 && folder.folders) {
        const subfolderPromises = folder.folders.map(async subfolder => {
          return await this.getFolderTree(subfolder.id, maxDepth - 1);
        });
        
        folder.folders = await Promise.all(subfolderPromises);
      }
      
      return folder;
    } catch (error) {
      console.error('Failed to get folder tree:', error);
      throw error;
    }
  }

  async shareFile(fileId: string, email?: string): Promise<void> {
    try {
      if (!this.isSignedIn()) {
        throw new Error(ERROR_MESSAGES.GOOGLE_DRIVE_AUTH_FAILED);
      }

      const permission = {
        role: 'reader',
        type: email ? 'user' : 'anyone',
        ...(email && { emailAddress: email }),
      };

      await window.gapi.client.drive.permissions.create({
        fileId: fileId,
        resource: permission,
      });
    } catch (error) {
      console.error('Failed to share file:', error);
      throw new Error(ERROR_MESSAGES.PERMISSION_ERROR);
    }
  }

    getAuthStatus(): { isSignedIn: boolean; userEmail?: string } {
    return {
      isSignedIn: this.isSignedIn(),
      userEmail: undefined, // Email will be managed by the main app's Google Identity Services
    };
  }

  async refreshToken(): Promise<boolean> {
    try {
      if (!this.isInitialized) return false;

      const isSignedIn = this.isSignedIn();
      
      if (!isSignedIn) return false;

      return true;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return false;
    }
  }

  /**
   * List folders in a specific directory
   */
  async listFolders(parentFolderId: string = 'root'): Promise<Array<{id: string; name: string; mimeType: string; parents?: string[]; createdTime?: string; modifiedTime?: string}>> {
    try {
      if (!this.isSignedIn()) {
        throw new Error(ERROR_MESSAGES.GOOGLE_DRIVE_AUTH_FAILED);
      }

      const response = await window.gapi.client.drive.files.list({
        q: `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id,name,mimeType,parents,createdTime,modifiedTime)',
        orderBy: 'name',
      });

      return (response.result.files || []).map((file: any) => ({
        id: file.id || '',
        name: file.name || '',
        mimeType: file.mimeType || 'application/vnd.google-apps.folder',
        parents: file.parents,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime
      }));
    } catch (error) {
      console.error('Failed to list folders:', error);
      throw new Error('Failed to list folders from Google Drive');
    }
  }

  /**
   * List files in a directory with optional filters
   */
  async listFiles(parentFolderId: string, options: {
    mimeType?: string;
    orderBy?: string;
    pageSize?: number;
  } = {}): Promise<GoogleDriveFile[]> {
    try {
      if (!this.isSignedIn()) {
        throw new Error(ERROR_MESSAGES.GOOGLE_DRIVE_AUTH_FAILED);
      }

      let query = `'${parentFolderId}' in parents and trashed=false`;
      
      if (options.mimeType) {
        query += ` and mimeType='${options.mimeType}'`;
      }

      const response = await window.gapi.client.drive.files.list({
        q: query,
        fields: 'files(id,name,mimeType,size,thumbnailLink,webContentLink,webViewLink,createdTime,modifiedTime)',
        orderBy: options.orderBy || 'name',
        pageSize: options.pageSize || 100,
      });

      return response.result.files || [];
    } catch (error) {
      console.error('Failed to list files:', error);
      throw new Error('Failed to list files from Google Drive');
    }
  }

  /**
   * Get file information
   */
  async getFileInfo(fileId: string): Promise<GoogleDriveFile> {
    try {
      if (!this.isSignedIn()) {
        throw new Error(ERROR_MESSAGES.GOOGLE_DRIVE_AUTH_FAILED);
      }

      const response = await window.gapi.client.drive.files.get({
        fileId: fileId,
        fields: 'id,name,mimeType,size,thumbnailLink,webContentLink,webViewLink,createdTime,modifiedTime,parents',
      });

      return response.result;
    } catch (error) {
      console.error('Failed to get file info:', error);
      throw new Error('Failed to get file information from Google Drive');
    }
  }

  /**
   * Get file download URL for templates
   */
  async getFileUrl(fileId: string): Promise<string> {
    try {
      if (!this.isSignedIn()) {
        throw new Error(ERROR_MESSAGES.GOOGLE_DRIVE_AUTH_FAILED);
      }

      // For PNG templates, we need a direct access URL
      return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&access_token=${this.accessToken}`;
    } catch (error) {
      console.error('Failed to get file URL:', error);
      throw new Error('Failed to get file URL from Google Drive');
    }
  }
}

// Export singleton instance
export const googleDriveService = new GoogleDriveService();
export default googleDriveService; 