/**
 * PNG Template Service
 * Manages PNG templates from Google Drive with automatic hole detection
 */

import { supabaseService } from './supabaseService';
import { supabase } from '../lib/supabase/client';
import googleDriveService from './googleDriveService';
import { templateDetectionService, TemplateAnalysisResult } from './templateDetectionService';
import { PrintSize } from '../types';

export interface PngTemplate {
  id: string;
  driveFileId: string;
  name: string;
  printSize: PrintSize;
  templateType: string; // Dynamic template types
  holes: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  pngUrl: string;
  dimensions: { width: number; height: number };
  hasInternalBranding: boolean;
  lastUpdated: Date;
  createdAt: Date;
}

export interface TemplateFolder {
  id: string;
  name: string;
  printSize: PrintSize;
}

export class PngTemplateService {
  private templates: PngTemplate[] = [];
  private lastSync: Date | null = null;
  private isLoading = false;

  /**
   * Get template folder ID from settings (localStorage-first approach)
   */
  async getTemplateFolderId(): Promise<string> {
    console.log('🔍 DEBUG: Starting getTemplateFolderId...');
    
    // 1. Check localStorage FIRST (most reliable)
    const localFolderId = localStorage.getItem('template_folder_id');
    console.log('🔍 DEBUG: localStorage value:', localFolderId);
    if (localFolderId && localFolderId.trim() !== '') {
      console.log('📁 Using template folder from localStorage:', localFolderId);
      return localFolderId;
    }

    // 2. Try database as secondary option
    try {
      const timestamp = new Date().getTime();
      console.log('🔍 DEBUG: Querying database for template_folder_id...');
      
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'template_folder_id')
        .order('created_at', { ascending: false })
        .limit(1);

      console.log('🔍 DEBUG: Database query result - data:', data, 'error:', error);

      if (data && data.length > 0 && data[0]?.value && data[0].value.trim() !== '') {
        console.log(`📁 Using template folder from database (${timestamp}):`, data[0].value);
        // Also save to localStorage for next time
        localStorage.setItem('template_folder_id', data[0].value);
        return data[0].value;
      }
      
      console.log('🔍 DEBUG: No valid database record found, checking environment...');
    } catch (error) {
      console.warn('⚠️ Database check failed, trying environment:', (error as Error).message);
    }

    // 3. Fall back to environment variable
    const envFolderId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_TEMPLATE_FOLDER_ID;
    console.log('🔍 DEBUG: Environment variable value:', envFolderId);
    if (envFolderId && envFolderId.trim() !== '') {
      console.log('📁 Using template folder from environment:', envFolderId);
      // Save to localStorage for next time
      localStorage.setItem('template_folder_id', envFolderId);
      return envFolderId;
    }

    // 4. Fall back to the user's known template folder ID (last resort)
    const defaultFolderId = '1pHfB79tNFAOFXOo5sRCuZ_P7IaJ3LXsq'; // User's "Print Templates" folder
    console.log('📁 Using default template folder (hardcoded):', defaultFolderId);
    // Save to localStorage for next time
    localStorage.setItem('template_folder_id', defaultFolderId);
    return defaultFolderId;
  }

  /**
   * Set template folder ID (localStorage-first approach)
   */
  async setTemplateFolderId(folderId: string): Promise<void> {
    console.log('✅ Setting template folder ID to localStorage:', folderId);
    
    // Save to localStorage (primary storage)
    localStorage.setItem('template_folder_id', folderId);
    console.log('✅ Template folder ID saved to localStorage successfully');
    
    // Try to save to database as backup (but don't fail if it doesn't work)
    try {
      console.log('🔄 Attempting to save to database as backup...');
      
      // Delete old record
      await supabase
        .from('app_settings')
        .delete()
        .eq('key', 'template_folder_id');

      // Insert new record
      const { error: insertError } = await supabase
        .from('app_settings')
        .insert({
          key: 'template_folder_id',
          value: folderId,
          description: 'Google Drive folder ID containing template subfolders'
        });

      if (insertError) {
        console.warn('⚠️ Database backup failed (localStorage is primary):', insertError.message);
      } else {
        console.log('✅ Database backup successful');
      }
    } catch (error) {
      console.warn('⚠️ Database backup failed (localStorage is primary):', error);
    }
    
    // Clear cache to force reload
    await this.clearCache();
    console.log('✅ setTemplateFolderId completed successfully');
  }

  /**
   * Load all templates from Google Drive
   */
  async loadTemplates(forceRefresh = false): Promise<PngTemplate[]> {
    if (this.isLoading) {
      console.log('⏳ Template loading already in progress...');
      return this.templates;
    }

    try {
      this.isLoading = true;
      console.log('🔄 Loading templates from Google Drive...');

      // Check if we have cached templates (unless force refresh)
      if (!forceRefresh && this.templates.length > 0 && this.lastSync) {
        const cacheAge = Date.now() - this.lastSync.getTime();
        if (cacheAge < 0) { // FORCE REFRESH - disabled cache for debugging hole detection
          console.log('📦 Using cached templates (cache age: ' + Math.round(cacheAge / 1000) + 's)');
          return this.templates;
        } else {
          console.log('🔄 Cache expired (age: ' + Math.round(cacheAge / 1000) + 's), refreshing...');
        }
      }

      const folderId = await this.getTemplateFolderId();
      const templates = await this.scanTemplateFolder(folderId);
      
      this.templates = templates;
      this.lastSync = new Date();
      
      console.log(`✅ Loaded ${templates.length} templates`);
      return templates;
    } catch (error) {
      console.error('❌ Error loading templates:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Scan template folder and process all PNG files
   */
  private async scanTemplateFolder(folderId: string): Promise<PngTemplate[]> {
    try {
      // Get all subfolders (4R, 5R, A4, etc.)
      const subfolders = await googleDriveService.listFolders(folderId);
      console.log(`📁 Found ${subfolders.length} print size folders:`, subfolders.map(f => f.name));

      // Debug: Log all folder details
      subfolders.forEach(folder => {
        console.log(`📂 Folder: "${folder.name}" (ID: ${folder.id})`);
      });

      const allTemplates: PngTemplate[] = [];

      for (const subfolder of subfolders) {
        const printSize = subfolder.name as PrintSize;
        
        // Validate print size
        if (!this.isValidPrintSize(printSize)) {
          console.warn(`⚠️ Skipping invalid print size folder: "${printSize}" (valid sizes: 4R, 5R, A4)`);
          continue;
        }

        console.log(`🔍 Scanning folder: ${printSize} (ID: ${subfolder.id})`);
        const folderTemplates = await this.processPrintSizeFolder(subfolder.id, printSize);
        console.log(`📄 Found ${folderTemplates.length} templates in ${printSize} folder`);
        allTemplates.push(...folderTemplates);
      }

      console.log(`📊 Total templates found: ${allTemplates.length}`);
      return allTemplates;
    } catch (error) {
      console.error('❌ Error scanning template folder:', error);
      throw error;
    }
  }

  /**
   * Process a single print size folder (e.g., 4R/)
   */
  private async processPrintSizeFolder(folderId: string, printSize: PrintSize): Promise<PngTemplate[]> {
    try {
      // First, let's get ALL files in the folder to see what's there
      const allFiles = await googleDriveService.listFiles(folderId);
      console.log(`📂 All files in ${printSize} folder:`, allFiles.map(f => `${f.name} (${f.mimeType})`));

      // Get all PNG files in the folder
      const pngFiles = await googleDriveService.listFiles(folderId, {
        mimeType: 'image/png'
      });

      console.log(`🖼️ Found ${pngFiles.length} PNG files in ${printSize} folder:`, 
        pngFiles.map(f => f.name));
      
      // Debug: Log each PNG file
      pngFiles.forEach(file => {
        console.log(`📄 PNG File: "${file.name}" (ID: ${file.id}, Size: ${file.size || 'unknown'})`);
      });

      const templates: PngTemplate[] = [];

      for (const file of pngFiles) {
        try {
          console.log(`🔬 Processing template: ${file.name}`);
          const template = await this.processTemplateFile(file, printSize);
          
          if (template) {
            templates.push(template);
            console.log(`✅ Successfully processed: ${file.name}`);
            // Cache in database
            await this.cacheTemplate(template);
          } else {
            console.log(`❌ Failed to process: ${file.name}`);
          }
        } catch (error) {
          console.error(`❌ Error processing template ${file.name}:`, error);
          // Continue with other templates
        }
      }

      return templates;
    } catch (error) {
      console.error(`❌ Error processing ${printSize} folder:`, error);
      return [];
    }
  }

  /**
   * Process a single template file
   */
  private async processTemplateFile(file: any, printSize: PrintSize): Promise<PngTemplate | null> {
    try {
      // Check if we have a cached version
      const cached = await this.getCachedTemplate(file.id);
      
      if (cached && new Date(file.modifiedTime) <= new Date(cached.lastUpdated)) {
        console.log(`📦 Using cached template: ${file.name}`);
        
        // Always regenerate display name to ensure it uses latest naming logic
        const updatedName = this.generateDisplayName(file.name, cached.templateType);
        if (cached.name !== updatedName) {
          console.log(`🏷️ Updating cached template name: "${cached.name}" → "${updatedName}"`);
          cached.name = updatedName;
          // Update cache with new name
          await this.cacheTemplate(cached);
        }
        
        return cached;
      }

      // Analyze template for holes using file ID directly
      console.log(`🔍 Analyzing template: ${file.name}`);
      const analysis = await templateDetectionService.analyzeTemplateByFileId(file.id, file.name);
      
      // Get download URL for display purposes
      const pngUrl = await googleDriveService.getFileUrl(file.id);
      
      // Validate analysis
      const validation = templateDetectionService.validateTemplate(analysis);
      if (!validation.isValid) {
        console.error(`❌ Template validation failed for ${file.name}:`, validation.errors);
        return null;
      }

      const template: PngTemplate = {
        id: file.id,
        driveFileId: file.id,
        name: this.generateDisplayName(file.name, analysis.templateType),
        printSize,
        templateType: analysis.templateType,
        holes: analysis.holes,
        pngUrl,
        dimensions: analysis.dimensions,
        hasInternalBranding: analysis.hasInternalBranding,
        lastUpdated: new Date(file.modifiedTime),
        createdAt: new Date(file.createdTime)
      };

      console.log(`✅ Successfully processed template: ${file.name} (${analysis.holes.length} holes, ${analysis.templateType})`);
      return template;
    } catch (error) {
      console.error(`❌ Error processing template file ${file.name}:`, error);
      return null;
    }
  }

  /**
   * Get cached template from database
   */
  private async getCachedTemplate(driveFileId: string): Promise<PngTemplate | null> {
    try {
      const { data, error } = await supabase
        .from('template_cache')
        .select('*')
        .eq('drive_file_id', driveFileId)
        .maybeSingle(); // Use maybeSingle instead of single to handle no results

      if (error) {
        console.warn('Cache lookup error (ignoring):', error.message);
        return null;
      }
      
      if (!data) return null;

      return {
        id: data.id,
        driveFileId: data.drive_file_id,
        name: data.name,
        printSize: data.print_size as PrintSize,
        templateType: data.template_type as any,
        holes: data.holes as any,
        pngUrl: data.png_url,
        dimensions: data.dimensions as any,
        hasInternalBranding: data.has_internal_branding,
        lastUpdated: new Date(data.last_updated),
        createdAt: new Date(data.created_at)
      };
    } catch (error) {
      console.error('❌ Error getting cached template:', error);
      return null;
    }
  }

  /**
   * Cache template in database
   */
  private async cacheTemplate(template: PngTemplate): Promise<void> {
    try {
      const { error } = await supabase
        .from('template_cache')
        .upsert({
          drive_file_id: template.driveFileId,
          name: template.name,
          print_size: template.printSize,
          template_type: template.templateType,
          holes: template.holes,
          png_url: template.pngUrl,
          dimensions: template.dimensions,
          has_internal_branding: template.hasInternalBranding,
          last_updated: template.lastUpdated.toISOString(),
        });

      if (error) {
        console.warn('⚠️ Cache save failed (continuing without cache):', error.message);
      } else {
        console.log(`💾 Cached template: ${template.name}`);
      }
    } catch (error) {
      console.warn('⚠️ Cache save failed (continuing without cache):', error);
    }
  }

  /**
   * Clear template cache
   */
  async clearCache(): Promise<void> {
    try {
      console.log('🗑️ Clearing template cache...');
      
      // Clear in-memory cache
      this.templates = [];
      this.lastSync = null;
      
      // Clear database cache - use gt('id', '0') to delete all records
      const { error, count } = await supabase
        .from('template_cache')
        .delete()
        .gt('created_at', '1970-01-01'); // Delete all records (created after Unix epoch)

      if (error) {
        console.error('❌ Error clearing database cache:', error);
      } else {
        console.log(`🗑️ Template cache cleared (deleted ${count || 'unknown'} records)`);
      }
      
    } catch (error) {
      console.error('❌ Error clearing cache:', error);
    }
  }

  /**
   * Get templates by print size
   */
  getTemplatesByPrintSize(printSize: PrintSize): PngTemplate[] {
    return this.templates.filter(template => template.printSize === printSize);
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): PngTemplate | null {
    return this.templates.find(template => template.id === id) || null;
  }

  /**
   * Generate a user-friendly display name from filename and template type
   */
  private generateDisplayName(filename: string, templateType: string): string {
    console.log(`🏷️ ========== NAME GENERATION ==========`);
    console.log(`🏷️ Input filename: "${filename}"`);
    console.log(`🏷️ Template type: "${templateType}"`);
    
    // Remove file extension
    let name = filename.replace(/\.(png|jpg|jpeg)$/i, '');
    console.log(`📝 After removing extension: "${name}"`);
    
    // Clean up common separators
    name = name.replace(/[-_]/g, ' ');
    console.log(`📝 After replacing separators: "${name}"`);
    
    // Try to extract a meaningful name
    const words = name.toLowerCase().split(/\s+/);
    console.log(`📝 Split into words:`, words);
    
    // Remove common template keywords from display name
    const filteredWords = words.filter(word => 
      !['template', 'png', 'jpg', 'jpeg', '1', '2', '3', '4', '5'].includes(word)
    );
    console.log(`📝 After filtering keywords:`, filteredWords);
    
    if (filteredWords.length > 0) {
      // Capitalize each word
      const cleanName = filteredWords
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      console.log(`✅ Generated clean name: "${cleanName}"`);
      console.log(`🏷️ ========== FINAL RESULT: "${cleanName}" ==========`);
      return cleanName;
    }
    
    // Fallback to template type with nice formatting
    const typeNames: Record<string, string> = {
      'solo': 'Solo Print',
      'collage': 'Collage Print', 
      'photocard': 'Photo Card',
      'photostrip': 'Photo Strip'
    };
    
    const fallbackName = typeNames[templateType] || 'Custom Template';
    console.log(`⚠️ Using fallback name: "${fallbackName}"`);
    console.log(`🏷️ ========== FINAL RESULT: "${fallbackName}" ==========`);
    return fallbackName;
  }

  /**
   * Validate print size
   */
  private isValidPrintSize(printSize: string): printSize is PrintSize {
    return ['4R', '5R', 'A4'].includes(printSize);
  }

  /**
   * Get template folder info
   */
  async getTemplateFolderInfo(): Promise<{ id: string; name: string; url: string } | null> {
    try {
      const folderId = await this.getTemplateFolderId();
      const folderInfo = await googleDriveService.getFileInfo(folderId);
      
      return {
        id: folderId,
        name: folderInfo.name,
        url: `https://drive.google.com/drive/folders/${folderId}`
      };
    } catch (error) {
      console.error('❌ Error getting template folder info:', error);
      return null;
    }
  }

  /**
   * Refresh templates from Google Drive
   */
  async refreshTemplates(): Promise<PngTemplate[]> {
    console.log('🔄 Refreshing templates...');
    await this.clearCache();
    return await this.loadTemplates(true);
  }
}

// Export singleton instance
export const pngTemplateService = new PngTemplateService();