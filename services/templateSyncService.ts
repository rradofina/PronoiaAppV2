/**
 * Template Sync Service
 * Manages real-time synchronization of completed templates to Google Drive
 * Handles background uploads, deletions, and folder management
 */

import { TemplateSlot, Photo, ManualTemplate } from '../types';
import { templateRasterizationService } from './templateRasterizationService';
import { manualTemplateService } from './manualTemplateService';
import googleDriveService from './googleDriveService';
import { getPrintSizeDimensions } from '../utils/printSizeDimensions';

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error';

interface TemplateSyncState {
  templateId: string;
  status: SyncStatus;
  lastSyncedAt?: Date;
  error?: string;
  driveFileId?: string;
}

interface SyncQueueItem {
  templateId: string;
  templateSlots: TemplateSlot[];
  photos: Photo[];
  priority: 'high' | 'normal' | 'low';
  retryCount: number;
  addedAt: Date;
}

class TemplateSyncService {
  private syncStates: Map<string, TemplateSyncState> = new Map();
  private syncQueue: Map<string, NodeJS.Timeout> = new Map();
  private uploadQueue: SyncQueueItem[] = [];
  private isProcessing: boolean = false;
  private draftFolderId: string | null = null;
  private clientFolderId: string | null = null;
  private DEBOUNCE_TIME = 3000; // 3 seconds
  private MAX_RETRIES = 3;

  /**
   * Initialize sync service for a client session
   */
  async initialize(clientFolderId: string): Promise<void> {
    console.log('🔄 Initializing template sync service for client:', clientFolderId);
    this.clientFolderId = clientFolderId;
    this.syncStates.clear();
    this.syncQueue.clear();
    this.uploadQueue = [];
    
    try {
      // Create or get prints_draft folder
      await this.ensureDraftFolder();
      console.log('✅ Sync service initialized successfully');
      console.log('  Draft folder ID:', this.draftFolderId);
    } catch (error) {
      console.error('❌ Failed to initialize sync service:', error);
      throw error;
    }
  }

  /**
   * Ensure prints_draft folder exists
   */
  private async ensureDraftFolder(): Promise<string> {
    if (!this.clientFolderId) {
      throw new Error('Client folder ID not set');
    }

    try {
      // Check if prints_draft folder exists
      console.log('📂 Checking for existing prints_draft folder in:', this.clientFolderId);
      const folders = await googleDriveService.listFolders(this.clientFolderId);
      console.log('  Found folders:', folders.map(f => f.name));
      const draftFolder = folders.find(f => f.name === 'prints_draft');
      
      if (draftFolder) {
        this.draftFolderId = draftFolder.id;
        console.log('✅ Found existing prints_draft folder:', this.draftFolderId);
        
        // Clean up any existing files (fresh start)
        const files = await googleDriveService.listFiles(this.draftFolderId, {});
        for (const file of files) {
          await googleDriveService.deleteFile(file.id);
        }
        console.log('🧹 Cleaned up', files.length, 'existing files in prints_draft');
      } else {
        // Create new prints_draft folder
        this.draftFolderId = await googleDriveService.createOutputFolder(
          this.clientFolderId,
          'prints_draft'
        );
        console.log('📁 Created new prints_draft folder:', this.draftFolderId);
      }
      
      return this.draftFolderId;
    } catch (error) {
      console.error('❌ Failed to ensure draft folder:', error);
      throw error;
    }
  }

  /**
   * Check if a template is complete (all slots filled)
   */
  isTemplateComplete(templateSlots: TemplateSlot[], templateId: string): boolean {
    const templateSpecificSlots = templateSlots.filter(s => s.templateId === templateId);
    return templateSpecificSlots.length > 0 && 
           templateSpecificSlots.every(s => s.photoId);
  }

  /**
   * Queue a template for syncing (debounced)
   */
  queueTemplateSync(
    templateId: string,
    templateSlots: TemplateSlot[],
    photos: Photo[],
    immediate: boolean = false
  ): void {
    // Check if template is complete
    if (!this.isTemplateComplete(templateSlots, templateId)) {
      console.log('⏸️ Template incomplete, skipping sync:', templateId);
      // If it was previously synced, delete it from Drive
      const syncState = this.syncStates.get(templateId);
      if (syncState?.status === 'synced') {
        this.deleteFromDrive(templateId);
      }
      return;
    }

    // Clear existing debounce timer
    const existingTimer = this.syncQueue.get(templateId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    if (immediate) {
      // Sync immediately
      this.addToUploadQueue(templateId, templateSlots, photos, 'high');
    } else {
      // Debounce for 3 seconds
      console.log('⏱️ Queueing template sync (3s debounce):', templateId);
      console.log('  Template slots count:', templateSlots.filter(s => s.templateId === templateId).length);
      console.log('  Photos available:', photos.length);
      const timer = setTimeout(() => {
        console.log('⏰ Debounce complete, adding to upload queue:', templateId);
        this.addToUploadQueue(templateId, templateSlots, photos, 'normal');
        this.syncQueue.delete(templateId);
      }, this.DEBOUNCE_TIME);
      
      this.syncQueue.set(templateId, timer);
    }
    
    // Update sync state to pending
    this.updateSyncState(templateId, 'pending');
  }

  /**
   * Add template to upload queue
   */
  private addToUploadQueue(
    templateId: string,
    templateSlots: TemplateSlot[],
    photos: Photo[],
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): void {
    // Remove existing queue item if present
    this.uploadQueue = this.uploadQueue.filter(item => item.templateId !== templateId);
    
    // Add new queue item
    const queueItem: SyncQueueItem = {
      templateId,
      templateSlots: templateSlots.filter(s => s.templateId === templateId),
      photos,
      priority,
      retryCount: 0,
      addedAt: new Date()
    };
    
    // Add based on priority
    if (priority === 'high') {
      this.uploadQueue.unshift(queueItem);
    } else {
      this.uploadQueue.push(queueItem);
    }
    
    console.log('📋 Added to upload queue:', templateId, 'Priority:', priority, 'Queue size:', this.uploadQueue.length);
    
    // Start processing if not already running
    this.processUploadQueue();
  }

  /**
   * Process upload queue
   */
  private async processUploadQueue(): Promise<void> {
    if (this.isProcessing || this.uploadQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    while (this.uploadQueue.length > 0) {
      const item = this.uploadQueue.shift();
      if (!item) break;
      
      try {
        await this.syncTemplate(item);
      } catch (error) {
        console.error('❌ Failed to sync template:', item.templateId, error);
        
        // Retry logic
        if (item.retryCount < this.MAX_RETRIES) {
          item.retryCount++;
          console.log('🔄 Retrying sync:', item.templateId, 'Attempt:', item.retryCount);
          this.uploadQueue.push(item); // Add back to end of queue
        } else {
          this.updateSyncState(item.templateId, 'error', `Failed after ${this.MAX_RETRIES} retries`);
        }
      }
    }
    
    this.isProcessing = false;
  }

  /**
   * Sync a single template to Google Drive
   */
  private async syncTemplate(item: SyncQueueItem): Promise<void> {
    const { templateId, templateSlots, photos } = item;
    
    if (!this.draftFolderId) {
      await this.ensureDraftFolder();
    }
    
    console.log('🔄 Syncing template:', templateId);
    console.log('  Slots for this template:', templateSlots.length);
    console.log('  Photos available:', photos.length);
    this.updateSyncState(templateId, 'syncing');
    
    try {
      // Find the manual template
      const firstSlot = templateSlots[0];
      if (!firstSlot) {
        throw new Error('No slots found for template');
      }
      
      // Get all templates to find the matching manual template
      const allTemplates = await manualTemplateService.getAllTemplates();
      
      // Try to find template by exact ID first
      let manualTemplate = allTemplates.find(t => 
        t.id.toString() === firstSlot.templateType
      );
      
      // If not found by ID, try by type and print size
      if (!manualTemplate) {
        manualTemplate = allTemplates.find(t => 
          t.template_type === firstSlot.templateType && 
          t.print_size === firstSlot.printSize
        );
      }
      
      if (!manualTemplate) {
        throw new Error(`Manual template not found for: ${firstSlot.templateType}`);
      }
      
      // Get the correct DPI for the template's print size
      const printDimensions = getPrintSizeDimensions(manualTemplate.print_size);
      const dpi = printDimensions.dpi || 300;
      
      // Rasterize the template
      console.log('🎨 Starting rasterization for template:', manualTemplate.name);
      const rasterized = await templateRasterizationService.rasterizeTemplate(
        manualTemplate,
        templateSlots,
        photos,
        {
          format: 'jpeg',
          quality: 0.95,
          includeBackground: true,
          dpi: dpi
        }
      );
      
      // Validate blob
      if (!rasterized.blob) {
        throw new Error('Rasterization failed - no blob returned');
      }
      console.log('✅ Rasterized blob size:', rasterized.blob.size, 'bytes');
      
      // Generate filename
      const fileName = `${firstSlot.templateName.replace(/[^a-zA-Z0-9]/g, '_')}_${templateId.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
      
      // Check if file already exists
      const existingState = this.syncStates.get(templateId);
      if (existingState?.driveFileId) {
        // Update existing file
        console.log('📝 Updating existing file:', fileName);
        await googleDriveService.updateFile(
          existingState.driveFileId,
          rasterized.blob,
          fileName,
          'image/jpeg'
        );
      } else {
        // Upload new file
        console.log('📤 Uploading new file:', fileName);
        const fileId = await googleDriveService.uploadFile(
          rasterized.blob,
          fileName,
          this.draftFolderId!,
          'image/jpeg'
        );
        
        // Store the file ID
        console.log('📁 File uploaded with ID:', fileId);
        this.updateSyncState(templateId, 'synced', undefined, fileId);
      }
      
      console.log('✅ Successfully synced:', templateId);
      // REMOVED DUPLICATE STATE UPDATE - This was overwriting the fileId!
      
    } catch (error) {
      console.error('❌ Sync failed for template:', templateId, error);
      console.error('  Error details:', error instanceof Error ? error.message : error);
      // Update state to show error
      this.updateSyncState(templateId, 'error', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Delete template from Google Drive immediately
   */
  async deleteFromDrive(templateId: string): Promise<void> {
    const syncState = this.syncStates.get(templateId);
    
    // Clear any pending sync
    const pendingTimer = this.syncQueue.get(templateId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.syncQueue.delete(templateId);
    }
    
    // Remove from upload queue
    this.uploadQueue = this.uploadQueue.filter(item => item.templateId !== templateId);
    
    // Delete from Drive if it was synced
    if (syncState?.driveFileId) {
      try {
        console.log('🗑️ Deleting template from Drive:', templateId);
        await googleDriveService.deleteFile(syncState.driveFileId);
        console.log('✅ Deleted from Drive:', templateId);
      } catch (error) {
        console.error('❌ Failed to delete from Drive:', templateId, error);
      }
    }
    
    // Remove sync state
    this.syncStates.delete(templateId);
  }

  /**
   * Update sync state for a template
   */
  private updateSyncState(
    templateId: string,
    status: SyncStatus,
    error?: string,
    driveFileId?: string
  ): void {
    const existingState = this.syncStates.get(templateId) || { templateId, status: 'pending' };
    
    this.syncStates.set(templateId, {
      ...existingState,
      status,
      lastSyncedAt: status === 'synced' ? new Date() : existingState.lastSyncedAt,
      error: error || undefined,
      driveFileId: driveFileId || existingState.driveFileId
    });
  }

  /**
   * Get sync status for a template
   */
  getSyncStatus(templateId: string): SyncStatus {
    return this.syncStates.get(templateId)?.status || 'pending';
  }

  /**
   * Get all sync states
   */
  getAllSyncStates(): Map<string, TemplateSyncState> {
    return this.syncStates;
  }

  /**
   * Flush all pending syncs - process immediately without waiting for debounce
   */
  private flushPendingSync(templateSlots: TemplateSlot[], photos: Photo[]): void {
    console.log('🚀 Flushing pending syncs before finalization');
    const pendingCount = this.syncQueue.size;
    
    if (pendingCount > 0) {
      console.log(`⚡ Processing ${pendingCount} pending sync(s) immediately`);
      
      // Process each pending sync immediately
      for (const [templateId, timer] of this.syncQueue.entries()) {
        // Clear the debounce timer
        clearTimeout(timer);
        
        // Add to upload queue with high priority
        console.log(`  📤 Flushing template: ${templateId}`);
        const templateSpecificSlots = templateSlots.filter(s => s.templateId === templateId);
        
        if (this.isTemplateComplete(templateSpecificSlots, templateId)) {
          this.addToUploadQueue(templateId, templateSlots, photos, 'high');
        }
      }
      
      // Clear the sync queue
      this.syncQueue.clear();
    } else {
      console.log('✅ No pending syncs to flush');
    }
  }

  /**
   * Wait for all uploads to complete
   */
  private async waitForUploads(): Promise<void> {
    console.log('⏳ Waiting for upload queue to complete...');
    console.log(`  📦 Queue size: ${this.uploadQueue.length}`);
    console.log(`  🔄 Processing: ${this.isProcessing}`);
    
    // Start processing if there are items and not already processing
    if (this.uploadQueue.length > 0 && !this.isProcessing) {
      this.processUploadQueue(); // Start processing (don't await)
    }
    
    // Wait for all processing to complete
    let checkCount = 0;
    while (this.isProcessing || this.uploadQueue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
      checkCount++;
      
      // Log progress every second
      if (checkCount % 10 === 0) {
        console.log(`  ⏱️ Still waiting... Queue: ${this.uploadQueue.length}, Processing: ${this.isProcessing}`);
      }
      
      // Safety check - if stuck for too long, try to restart processing
      if (checkCount > 300 && this.uploadQueue.length > 0 && !this.isProcessing) {
        console.log('  ⚠️ Processing seems stuck, restarting...');
        this.processUploadQueue();
      }
    }
    
    console.log('✅ All uploads completed');
  }

  /**
   * Finalize session - rename draft folder to prints
   */
  async finalizeSession(templateSlots: TemplateSlot[], photos: Photo[]): Promise<void> {
    if (!this.draftFolderId) {
      throw new Error('No draft folder to finalize');
    }
    
    try {
      console.log('🏁 Finalizing session - processing pending syncs first');
      
      // Step 1: Flush all pending syncs (process immediately without waiting for debounce)
      console.log('🔍 Current sync status:', {
        pendingSyncs: this.syncQueue.size,
        uploadQueueSize: this.uploadQueue.length,
        isProcessing: this.isProcessing
      });
      
      this.flushPendingSync(templateSlots, photos);
      
      // Step 2: Wait for all uploads to complete
      console.log('⏳ Waiting for all uploads to complete...');
      await this.waitForUploads();
      
      console.log('✅ All templates synced, proceeding with folder rename');
      
      // Step 3: Check if prints folder already exists and delete it
      const folders = await googleDriveService.listFolders(this.clientFolderId!);
      const existingPrintsFolder = folders.find(f => f.name === 'prints');
      
      if (existingPrintsFolder) {
        console.log('🗑️ Removing existing prints folder');
        await googleDriveService.deleteFolder(existingPrintsFolder.id);
      }
      
      // Step 4: Rename draft folder to prints
      await googleDriveService.renameFolder(this.draftFolderId, 'prints');
      console.log('✅ Successfully renamed prints_draft to prints');
      
      // Step 5: Clear all states
      this.syncStates.clear();
      this.syncQueue.clear();
      this.uploadQueue = [];
      this.draftFolderId = null;
      
    } catch (error) {
      console.error('❌ Failed to finalize session:', error);
      throw error;
    }
  }

  /**
   * Clean up service (cancel all pending syncs)
   */
  cleanup(): void {
    // Clear all timers
    for (const timer of this.syncQueue.values()) {
      clearTimeout(timer);
    }
    this.syncQueue.clear();
    
    // Clear queues
    this.uploadQueue = [];
    this.isProcessing = false;
    
    console.log('🧹 Template sync service cleaned up');
  }
}

// Export singleton instance
export const templateSyncService = new TemplateSyncService();