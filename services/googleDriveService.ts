/// <reference types="gapi" />
/// <reference types="gapi.client.drive-v3" />
// Updated: Google Drive service.
import { GoogleDriveFile, GoogleDriveFolder, Photo } from '../types';
import { GOOGLE_DRIVE_CONFIG, SUPPORTED_IMAGE_TYPES, ERROR_MESSAGES } from '../utils/constants';

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
      console.error('Failed to initialize Google Drive API:', error);
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
    if (window.gapi && window.gapi.client) {
      window.gapi.client.setToken({ access_token: token });
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

  async listFolders(parentId?: string): Promise<Array<{id: string; name: string; mimeType: string; parents?: string[]}>> {
    try {
      if (!this.isSignedIn()) {
        throw new Error(ERROR_MESSAGES.GOOGLE_DRIVE_AUTH_FAILED);
      }

      const folderId = parentId || 'root';
      const query = `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

      const response = await window.gapi.client.drive.files.list({
        q: query,
        fields: 'files(id,name,mimeType,parents)',
        pageSize: 1000,
        orderBy: 'name',
      });

      return response.result.files || [];
    } catch (error) {
      console.error('Failed to list folders:', error);
      throw new Error(ERROR_MESSAGES.GOOGLE_DRIVE_FOLDER_NOT_FOUND);
    }
  }

  async getFolderContents(folderId: string): Promise<GoogleDriveFolder> {
    try {
      if (!this.isSignedIn()) {
        throw new Error(ERROR_MESSAGES.GOOGLE_DRIVE_AUTH_FAILED);
      }

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
          if (file.mimeType === 'application/vnd.google-apps.folder') {
            folders.push({
              id: file.id || '',
              name: file.name || '',
              files: [],
              folders: [],
            });
          } else if (this.isImageFile(file.mimeType || '')) {
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
          }
        }
        pageToken = filesResponse.result.nextPageToken;
      } while (pageToken);

      return {
        id: folderResponse.result.id,
        name: folderResponse.result.name,
        files,
        folders,
      };
    } catch (error) {
      console.error('Failed to get folder contents:', error);
      throw new Error(ERROR_MESSAGES.GOOGLE_DRIVE_FOLDER_NOT_FOUND);
    }
  }

  async getPhotosFromFolder(folderId: string): Promise<Photo[]> {
    try {
      const folder = await this.getFolderContents(folderId);
      console.log(`Found ${folder.files.length} files in folder`);
      
      // First try with thumbnails (simpler approach)
      const photos = folder.files.map((file) => {
        const thumbnailUrl = file.thumbnailLink || this.getThumbnailUrl(file.id);
        console.log(`Photo: ${file.name}, thumbnailUrl: ${thumbnailUrl}`);
        
        return {
          id: file.id,
          url: thumbnailUrl, // Use thumbnail URL for now
          thumbnailUrl: thumbnailUrl,
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

      console.log(`Returning ${photos.length} photos`);
      return photos;
    } catch (error) {
      console.error('Failed to get photos from folder:', error);
      throw error;
    }
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
        throw new Error('Failed to download photo');
      }

      return await response.blob();
    } catch (error) {
      console.error('Failed to download photo:', error);
      throw new Error(ERROR_MESSAGES.PHOTO_LOAD_FAILED);
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
    return SUPPORTED_IMAGE_TYPES.indexOf(mimeType) !== -1;
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
      
      if (maxDepth > 0) {
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
}

// Export singleton instance
export const googleDriveService = new GoogleDriveService();
export default googleDriveService; 