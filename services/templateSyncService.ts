/**
 * Template Sync Service
 * Manages real-time synchronization of completed templates to Google Drive
 * Handles background uploads, updates, deletions, and smart file management
 * Syncs directly to 'prints' folder without intermediate drafts
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
  private printsFolderId: string | null = null; // Changed from draftFolderId
  private clientFolderId: string | null = null;
  private DEBOUNCE_TIME = 3000; // 3 seconds
  private MAX_RETRIES = 3;
  private isUserInteracting: boolean = false; // Track if user is actively interacting
  private YIELD_DELAY = 100; // ms to yield between syncs for UI responsiveness
  private PARALLEL_BATCH_SIZE = 2; // Process 2 templates at once for balanced performance
  private activeOperations = 0; // Track active parallel operations
  private existingFiles: Map<string, string> = new Map(); // Map template ID to Drive file ID
  private isInitialized: boolean = false; // Track initialization state

  /**
   * Initialize sync service for a client session
   * @throws Error if initialization fails
   */
  async initialize(clientFolderId: string): Promise<void> {
    if (process.env.NODE_ENV === 'development') console.log('🔄 Initializing template sync service for client:', clientFolderId);
    this.isInitialized = false; // Reset initialization state
    this.clientFolderId = clientFolderId;
    this.syncStates.clear();
    this.syncQueue.clear();
    this.uploadQueue = [];
    
    try {
      // Create or get prints folder
      await this.ensurePrintsFolder();
      this.isInitialized = true; // Mark as initialized only after successful setup
      if (process.env.NODE_ENV === 'development') console.log('✅ Sync service initialized successfully');
      if (process.env.NODE_ENV === 'development') console.log('  Prints folder ID:', this.printsFolderId);
    } catch (error) {
      console.error('❌ Failed to initialize sync service:', error);
      this.isInitialized = false;
      // Throw error so UI can handle it properly
      throw new Error(`Failed to initialize sync service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ensure prints folder exists and load existing files
   */
  private async ensurePrintsFolder(): Promise<string> {
    if (!this.clientFolderId) {
      throw new Error('Client folder ID not set');
    }

    try {
      // Check if prints folder exists
      if (process.env.NODE_ENV === 'development') console.log('📂 Checking for existing prints folder in:', this.clientFolderId);
      const folders = await googleDriveService.listFolders(this.clientFolderId);
      if (process.env.NODE_ENV === 'development') console.log('  Found folders:', folders.map(f => f.name));
      const printsFolder = folders.find(f => f.name === 'prints');
      
      if (printsFolder) {
        this.printsFolderId = printsFolder.id;
        if (process.env.NODE_ENV === 'development') console.log('✅ Found existing prints folder:', this.printsFolderId);
        
        // Load existing files to track what's already uploaded
        const files = await googleDriveService.listFiles(this.printsFolderId, {});
        this.existingFiles.clear();
        
        for (const file of files) {
          // Extract template ID from filename (format: TemplateName_TemplateID.jpg)
          const match = file.name.match(/_([^_]+)\.jpg$/);
          if (match) {
            const templateId = match[1];
            this.existingFiles.set(templateId, file.id);
            if (process.env.NODE_ENV === 'development') console.log(`  📄 Found existing template: ${templateId} -> ${file.id}`);
          }
        }
        if (process.env.NODE_ENV === 'development') console.log(`📊 Loaded ${this.existingFiles.size} existing templates`);
      } else {
        // Create new prints folder
        this.printsFolderId = await googleDriveService.createOutputFolder(
          this.clientFolderId,
          'prints'
        );
        if (process.env.NODE_ENV === 'development') console.log('📁 Created new prints folder:', this.printsFolderId);
      }
      
      return this.printsFolderId;
    } catch (error) {
      console.error('❌ Failed to ensure prints folder:', error);
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
    if (process.env.NODE_ENV === 'development') console.log('📌 queueTemplateSync called for:', templateId, { immediate });
    
    // Guard: Don't sync if service not initialized
    if (!this.isInitialized) {
      console.warn('⚠️ SYNC BLOCKED: Service not initialized, skipping sync for:', templateId);
      console.warn('  To enable sync, ensure prints folder can be created in Google Drive');
      return;
    }

    // Check if template is complete
    if (!this.isTemplateComplete(templateSlots, templateId)) {
      if (process.env.NODE_ENV === 'development') console.log('⏸️ Template incomplete, skipping sync:', templateId);
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

    if (process.env.NODE_ENV === 'development') console.log('✅ Template is complete, will sync:', templateId);
    if (process.env.NODE_ENV === 'development') console.log('  Current queue size:', this.uploadQueue.length);
    if (process.env.NODE_ENV === 'development') console.log('  Is processing:', this.isProcessing);
    
    if (immediate) {
      if (process.env.NODE_ENV === 'development') console.log('⚡ Immediate sync requested');
      // Sync immediately
      this.addToUploadQueue(templateId, templateSlots, photos, 'high');
    } else {
      // Debounce for 3 seconds
      if (process.env.NODE_ENV === 'development') console.log(`⏱️ Queueing template sync (${this.DEBOUNCE_TIME}ms debounce):`, templateId);
      if (process.env.NODE_ENV === 'development') console.log('  Template slots count:', templateSlots.filter(s => s.templateId === templateId).length);
      if (process.env.NODE_ENV === 'development') console.log('  Photos available:', photos.length);
      const timer = setTimeout(() => {
        if (process.env.NODE_ENV === 'development') console.log('⏰ Debounce complete, adding to upload queue:', templateId);
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
    
    if (process.env.NODE_ENV === 'development') console.log('📋 Added to upload queue:', templateId, 'Priority:', priority, 'Queue size:', this.uploadQueue.length);
    
    // Start processing if not already running
    // Use setTimeout to avoid potential race conditions
    setTimeout(() => this.processUploadQueue(), 0);
  }

  /**
   * Process upload queue with parallel batch processing
   */
  private async processUploadQueue(): Promise<void> {
    // Check if already processing
    if (this.isProcessing) {
      if (process.env.NODE_ENV === 'development') console.log('⏸️ Already processing queue, skipping');
      return;
    }
    
    // Check if queue is empty
    if (this.uploadQueue.length === 0) {
      if (process.env.NODE_ENV === 'development') console.log('📭 Queue is empty, nothing to process');
      return;
    }
    
    this.isProcessing = true;
    if (process.env.NODE_ENV === 'development') console.log(`🚀 Starting parallel sync processing with batch size ${this.PARALLEL_BATCH_SIZE}`);
    if (process.env.NODE_ENV === 'development') console.log(`📦 Queue contains ${this.uploadQueue.length} items`);
    
    while (this.uploadQueue.length > 0) {
      // If user is interacting, pause all processing
      if (this.isUserInteracting) {
        if (process.env.NODE_ENV === 'development') console.log('⏸️ Pausing sync - user is interacting');
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for interaction to complete
        continue;
      }
      
      // Take a batch of templates to process in parallel
      const batchSize = Math.min(this.PARALLEL_BATCH_SIZE, this.uploadQueue.length);
      const batch = this.uploadQueue.splice(0, batchSize);
      
      if (process.env.NODE_ENV === 'development') console.log(`📦 Processing batch of ${batch.length} templates in parallel`);
      this.activeOperations = batch.length;
      
      try {
        // Process batch in parallel using Promise.allSettled to handle individual failures
        const results = await Promise.allSettled(
          batch.map(async (item) => {
            // Check user interaction before starting each template
            if (this.isUserInteracting) {
              throw new Error('User interaction detected, deferring sync');
            }
            return this.syncTemplate(item);
          })
        );
        
        // Handle results and retry failed items
        results.forEach((result, index) => {
          const item = batch[index];
          
          if (result.status === 'rejected') {
            const error = result.reason;
            console.error('❌ Failed to sync template:', item.templateId, error);
            
            // Check if it was due to user interaction
            if (error?.message?.includes('User interaction detected')) {
              // Put back at front of queue for immediate retry
              this.uploadQueue.unshift(item);
            } else {
              // Normal retry logic for other failures
              if (item.retryCount < this.MAX_RETRIES) {
                item.retryCount++;
                if (process.env.NODE_ENV === 'development') console.log('🔄 Retrying sync:', item.templateId, 'Attempt:', item.retryCount);
                this.uploadQueue.push(item); // Add back to end of queue
              } else {
                this.updateSyncState(item.templateId, 'error', `Failed after ${this.MAX_RETRIES} retries`);
              }
            }
          } else {
            if (process.env.NODE_ENV === 'development') console.log('✅ Successfully synced in batch:', item.templateId);
          }
        });
        
      } catch (error) {
        // This shouldn't happen with allSettled, but handle just in case
        console.error('❌ Batch processing error:', error);
        // Put all items back for retry
        batch.forEach(item => {
          if (item.retryCount < this.MAX_RETRIES) {
            item.retryCount++;
            this.uploadQueue.push(item);
          }
        });
      }
      
      this.activeOperations = 0;
      
      // Yield to UI after each batch to prevent blocking
      await this.yieldToUI();
      
      // Additional pause if user started interacting during batch
      if (this.isUserInteracting) {
        if (process.env.NODE_ENV === 'development') console.log('⏸️ User interaction detected after batch, pausing...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (process.env.NODE_ENV === 'development') console.log('✅ Parallel sync processing complete');
    this.isProcessing = false;
  }

  /**
   * Yield control back to the browser for UI updates
   */
  private async yieldToUI(): Promise<void> {
    // Use requestAnimationFrame to ensure UI has a chance to update
    await new Promise(resolve => {
      if (typeof window !== 'undefined' && window.requestAnimationFrame) {
        window.requestAnimationFrame(() => {
          setTimeout(resolve, this.YIELD_DELAY);
        });
      } else {
        setTimeout(resolve, this.YIELD_DELAY);
      }
    });
  }

  /**
   * Sync a single template to Google Drive
   */
  private async syncTemplate(item: SyncQueueItem): Promise<void> {
    const { templateId, templateSlots, photos } = item;
    
    if (!this.printsFolderId) {
      await this.ensurePrintsFolder();
    }
    
    if (process.env.NODE_ENV === 'development') console.log('🔄 Syncing template:', templateId);
    if (process.env.NODE_ENV === 'development') console.log('  Slots for this template:', templateSlots.length);
    if (process.env.NODE_ENV === 'development') console.log('  Photos available:', photos.length);
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
      
      // Check user interaction before heavy rasterization
      if (this.isUserInteracting) {
        throw new Error('User interaction detected, deferring sync');
      }
      
      // Rasterize the template - use lower quality for drafts to speed up processing
      if (process.env.NODE_ENV === 'development') console.log('🎨 Starting rasterization for template:', manualTemplate.name);
      const rasterized = await templateRasterizationService.rasterizeTemplate(
        manualTemplate,
        templateSlots,
        photos,
        {
          format: 'jpeg',
          quality: 0.85, // Reduced from 0.95 for faster processing
          includeBackground: true,
          dpi: dpi
        }
      );
      
      // Check user interaction after rasterization
      if (this.isUserInteracting) {
        throw new Error('User interaction detected, deferring sync');
      }
      
      // Validate blob
      if (!rasterized.blob) {
        throw new Error('Rasterization failed - no blob returned');
      }
      if (process.env.NODE_ENV === 'development') console.log('✅ Rasterized blob size:', rasterized.blob.size, 'bytes');
      
      // Generate filename with new naming convention: Print_[Number]_[TemplateType]_[PrintSize]_[ShortTimestamp].jpg
      // Extract print number from template name (e.g., "Print #1" -> "1")
      const printMatch = firstSlot.templateName.match(/Print.*?(\d+)/i);
      const printNumber = printMatch ? printMatch[1] : '1';
      
      // Get template type from manual template name (e.g., "collage", "photostrip", "solo")
      const templateType = manualTemplate.template_type || firstSlot.templateType || 'Template';
      const capitalizedType = templateType.charAt(0).toUpperCase() + templateType.slice(1);
      
      // Get print size
      const printSize = firstSlot.printSize || manualTemplate.print_size || '4R';
      
      // Short timestamp (last 6 digits)
      const shortTimestamp = Date.now().toString().slice(-6);
      
      const fileName = `Print_${printNumber}_${capitalizedType}_${printSize}_${shortTimestamp}.jpg`;
      
      // Check if file already exists (either in sync state or from previous session)
      const existingFileId = this.syncStates.get(templateId)?.driveFileId || this.existingFiles.get(templateId);
      
      if (existingFileId) {
        // Try to update existing file
        if (process.env.NODE_ENV === 'development') console.log('📝 Updating existing file:', fileName);
        try {
          await googleDriveService.updateFile(
            existingFileId,
            rasterized.blob,
            fileName,
            'image/jpeg'
          );
          // Update sync state with existing file ID
          this.updateSyncState(templateId, 'synced', undefined, existingFileId);
        } catch (updateError: any) {
          // Check if file was deleted from Drive
          if (updateError.message && updateError.message.includes('File not found')) {
            if (process.env.NODE_ENV === 'development') console.log('⚠️ File not found in Drive, uploading as new file:', fileName);
            // File was deleted, upload as new
            const fileId = await googleDriveService.uploadFile(
              rasterized.blob,
              fileName,
              this.printsFolderId!,
              'image/jpeg'
            );
            if (process.env.NODE_ENV === 'development') console.log('📁 New file uploaded with ID:', fileId);
            this.updateSyncState(templateId, 'synced', undefined, fileId);
            // Update tracking with new file ID
            this.existingFiles.set(templateId, fileId);
          } else {
            // Re-throw other errors
            throw updateError;
          }
        }
      } else {
        // Upload new file
        if (process.env.NODE_ENV === 'development') console.log('📤 Uploading new file:', fileName);
        const fileId = await googleDriveService.uploadFile(
          rasterized.blob,
          fileName,
          this.printsFolderId!,
          'image/jpeg'
        );
        
        // Store the file ID
        if (process.env.NODE_ENV === 'development') console.log('📁 File uploaded with ID:', fileId);
        this.updateSyncState(templateId, 'synced', undefined, fileId);
        // Also track in existing files for future updates
        this.existingFiles.set(templateId, fileId);
      }
      
      if (process.env.NODE_ENV === 'development') console.log('✅ Successfully synced:', templateId);
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
    // Guard: Don't try to delete if not initialized
    if (!this.isInitialized) {
      if (process.env.NODE_ENV === 'development') console.log('⚠️ Sync service not initialized, skipping delete for:', templateId);
      return;
    }

    const syncState = this.syncStates.get(templateId);
    const existingFileId = syncState?.driveFileId || this.existingFiles.get(templateId);
    
    // Clear any pending sync
    const pendingTimer = this.syncQueue.get(templateId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.syncQueue.delete(templateId);
    }
    
    // Remove from upload queue
    this.uploadQueue = this.uploadQueue.filter(item => item.templateId !== templateId);
    
    // Delete from Drive if it exists
    if (existingFileId) {
      try {
        if (process.env.NODE_ENV === 'development') console.log('🗑️ Deleting template from Drive:', templateId);
        await googleDriveService.deleteFile(existingFileId);
        if (process.env.NODE_ENV === 'development') console.log('✅ Deleted from Drive:', templateId);
        // Remove from existing files map
        this.existingFiles.delete(templateId);
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
   * Get sync status for a specific template
   */
  getTemplateSyncStatus(templateId: string): SyncStatus {
    return this.syncStates.get(templateId)?.status || 'pending';
  }

  /**
   * Get all sync states
   */
  getAllSyncStates(): Map<string, TemplateSyncState> {
    return this.syncStates;
  }

  /**
   * Check if service is initialized and ready
   */
  getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Set user interaction state - call this when user starts/stops dragging
   */
  setUserInteracting(isInteracting: boolean): void {
    // Guard: Only set if initialized
    if (!this.isInitialized) {
      return;
    }
    
    this.isUserInteracting = isInteracting;
    if (isInteracting) {
      if (process.env.NODE_ENV === 'development') console.log('🔄 User interaction started - background sync will pause');
    } else {
      if (process.env.NODE_ENV === 'development') console.log('▶️ User interaction ended - background sync will resume');
      // Resume processing if there are pending items
      if (this.uploadQueue.length > 0 && !this.isProcessing) {
        this.processUploadQueue();
      }
    }
  }

  /**
   * Flush all pending syncs - process immediately without waiting for debounce
   */
  private flushPendingSync(templateSlots: TemplateSlot[], photos: Photo[]): void {
    if (process.env.NODE_ENV === 'development') console.log('🚀 Flushing pending syncs before finalization');
    const pendingCount = this.syncQueue.size;
    
    if (pendingCount > 0) {
      if (process.env.NODE_ENV === 'development') console.log(`⚡ Processing ${pendingCount} pending sync(s) immediately`);
      
      // Process each pending sync immediately
      for (const [templateId, timer] of this.syncQueue.entries()) {
        // Clear the debounce timer
        clearTimeout(timer);
        
        // Add to upload queue with high priority
        if (process.env.NODE_ENV === 'development') console.log(`  📤 Flushing template: ${templateId}`);
        const templateSpecificSlots = templateSlots.filter(s => s.templateId === templateId);
        
        if (this.isTemplateComplete(templateSpecificSlots, templateId)) {
          this.addToUploadQueue(templateId, templateSlots, photos, 'high');
        }
      }
      
      // Clear the sync queue
      this.syncQueue.clear();
    } else {
      if (process.env.NODE_ENV === 'development') console.log('✅ No pending syncs to flush');
    }
  }

  /**
   * Wait for all uploads to complete
   */
  private async waitForUploads(): Promise<void> {
    if (process.env.NODE_ENV === 'development') console.log('⏳ Waiting for upload queue to complete...');
    if (process.env.NODE_ENV === 'development') console.log(`  📦 Queue size: ${this.uploadQueue.length}`);
    if (process.env.NODE_ENV === 'development') console.log(`  🔄 Processing: ${this.isProcessing}`);
    
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
        if (process.env.NODE_ENV === 'development') console.log(`  ⏱️ Still waiting... Queue: ${this.uploadQueue.length}, Processing: ${this.isProcessing}`);
      }
      
      // Safety check - if stuck for too long, try to restart processing
      if (checkCount > 300 && this.uploadQueue.length > 0 && !this.isProcessing) {
        if (process.env.NODE_ENV === 'development') console.log('  ⚠️ Processing seems stuck, restarting...');
        this.processUploadQueue();
      }
    }
    
    if (process.env.NODE_ENV === 'development') console.log('✅ All uploads completed');
  }

  /**
   * Finalize session - process pending syncs and clean up
   */
  async finalizeSession(templateSlots: TemplateSlot[], photos: Photo[]): Promise<void> {
    // Guard: Don't finalize if not initialized
    if (!this.isInitialized) {
      if (process.env.NODE_ENV === 'development') console.log('⚠️ Sync service not initialized, skipping finalization');
      return;
    }

    try {
      if (process.env.NODE_ENV === 'development') console.log('🏁 Finalizing session - processing pending syncs');
      
      // Step 1: Flush all pending syncs (process immediately without waiting for debounce)
      if (process.env.NODE_ENV === 'development') console.log('🔍 Current sync status:', {
        pendingSyncs: this.syncQueue.size,
        uploadQueueSize: this.uploadQueue.length,
        isProcessing: this.isProcessing
      });
      
      this.flushPendingSync(templateSlots, photos);
      
      // Step 2: Wait for all uploads to complete
      if (process.env.NODE_ENV === 'development') console.log('⏳ Waiting for all uploads to complete...');
      await this.waitForUploads();
      
      if (process.env.NODE_ENV === 'development') console.log('✅ All templates synced successfully');
      
      // Step 3: Clean up templates that are no longer in the session
      await this.cleanupRemovedTemplates(templateSlots);
      
      // Step 4: Clear session states (but keep existing files map for next session)
      this.syncStates.clear();
      this.syncQueue.clear();
      this.uploadQueue = [];
      
      if (process.env.NODE_ENV === 'development') console.log('🎯 Session finalized - prints folder is ready');
      
    } catch (error) {
      console.error('❌ Failed to finalize session:', error);
      throw error;
    }
  }

  /**
   * Clean up templates that were removed from the session
   */
  private async cleanupRemovedTemplates(currentTemplateSlots: TemplateSlot[]): Promise<void> {
    // Get all current template IDs
    const currentTemplateIds = new Set(
      currentTemplateSlots
        .map(slot => slot.templateId)
        .filter(id => id) // Filter out any undefined/null values
    );
    
    // Find templates that exist in Drive but not in current session
    const templatesToDelete: string[] = [];
    for (const [templateId, fileId] of this.existingFiles.entries()) {
      if (!currentTemplateIds.has(templateId)) {
        templatesToDelete.push(templateId);
      }
    }
    
    if (templatesToDelete.length > 0) {
      if (process.env.NODE_ENV === 'development') console.log(`🧹 Cleaning up ${templatesToDelete.length} removed templates`);
      for (const templateId of templatesToDelete) {
        await this.deleteFromDrive(templateId);
      }
    } else {
      if (process.env.NODE_ENV === 'development') console.log('✅ No templates to clean up');
    }
  }

  /**
   * Manually trigger processing of the upload queue (for debugging)
   */
  async forceProcessQueue(): Promise<void> {
    if (process.env.NODE_ENV === 'development') console.log('🔨 Force processing queue manually');
    if (process.env.NODE_ENV === 'development') console.log('  Queue size:', this.uploadQueue.length);
    if (process.env.NODE_ENV === 'development') console.log('  Is processing:', this.isProcessing);
    if (process.env.NODE_ENV === 'development') console.log('  Is initialized:', this.isInitialized);
    
    if (!this.isInitialized) {
      console.error('❌ Cannot process - service not initialized');
      return;
    }
    
    if (this.uploadQueue.length === 0) {
      if (process.env.NODE_ENV === 'development') console.log('📭 Queue is empty, nothing to process');
      return;
    }
    
    if (this.isProcessing) {
      if (process.env.NODE_ENV === 'development') console.log('⚠️ Already processing, forcing isProcessing to false and retrying');
      this.isProcessing = false;
    }
    
    await this.processUploadQueue();
  }
  
  /**
   * Get current sync status (for debugging)
   */
  getSyncStatus(): {
    isInitialized: boolean;
    isProcessing: boolean;
    queueSize: number;
    pendingDebounce: number;
    syncedTemplates: number;
    printsFolderId: string | null;
  } {
    return {
      isInitialized: this.isInitialized,
      isProcessing: this.isProcessing,
      queueSize: this.uploadQueue.length,
      pendingDebounce: this.syncQueue.size,
      syncedTemplates: Array.from(this.syncStates.values()).filter(s => s.status === 'synced').length,
      printsFolderId: this.printsFolderId
    };
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
    
    // Keep printsFolderId and existingFiles for next session
    // This allows us to reuse the same folder and track existing files
    
    if (process.env.NODE_ENV === 'development') console.log('🧹 Template sync service cleaned up');
  }
}

// Export singleton instance
export const templateSyncService = new TemplateSyncService();

// Expose to window for debugging (development only)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).templateSyncService = templateSyncService;
  if (process.env.NODE_ENV === 'development') console.log('📝 Template sync service exposed to window for debugging');
  if (process.env.NODE_ENV === 'development') console.log('  Use window.templateSyncService.getSyncStatus() to check status');
  if (process.env.NODE_ENV === 'development') console.log('  Use window.templateSyncService.forceProcessQueue() to manually trigger processing');
}