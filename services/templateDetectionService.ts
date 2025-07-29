/**
 * Template Detection Service
 * Analyzes PNG files to automatically detect photo placement areas (holes) 
 * marked with magenta (#FF00FF) color regions
 */

import { templateConfigService } from './templateConfigService';

export interface TemplateHole {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TemplateAnalysisResult {
  holes: TemplateHole[];
  dimensions: { width: number; height: number };
  hasInternalBranding: boolean;
  templateType: string; // Dynamic template types
}

interface Point {
  x: number;
  y: number;
}

interface Rectangle {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export class TemplateDetectionService {
  private static readonly PLACEHOLDER_COLORS = [
    [255, 0, 255], // #FF00FF - Pure magenta
    [185, 82, 159] // #b9529f - Photoshop CMYK-converted magenta
  ];
  private static readonly COLOR_TOLERANCE = 15; // Allow slight variations due to compression
  private static readonly MIN_HOLE_SIZE = 50; // Minimum hole size in pixels

  /**
   * Analyze a PNG template by file ID to detect photo placement holes
   */
  async analyzeTemplateByFileId(fileId: string, filename?: string): Promise<TemplateAnalysisResult> {
    try {
      // Download the image from Google Drive as a blob
      const blobUrl = await this.createBlobUrlFromFileId(fileId);
      
      return new Promise((resolve, reject) => {
        const img = new Image();
        
        img.onload = async () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              reject(new Error('Could not get canvas context'));
              return;
            }

            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const holes = this.detectPlaceholderRegions(imageData);
            const templateType = await this.determineTemplateType(holes, filename);
            const hasInternalBranding = this.detectInternalBranding(imageData, holes);
            
            // Clean up blob URL
            URL.revokeObjectURL(blobUrl);
            
            console.log(`📐 TEMPLATE ANALYSIS COMPLETE:`, {
              filename,
              imageDimensions: { width: img.width, height: img.height },
              holesFound: holes.length,
              holes: holes.map(h => ({ 
                id: h.id, 
                dimensions: `${h.width}×${h.height}`, 
                aspectRatio: (h.width / h.height).toFixed(2) 
              }))
            });
            
            resolve({
              holes,
              dimensions: { width: img.width, height: img.height },
              hasInternalBranding,
              templateType
            });
          } catch (error) {
            // Clean up blob URL on error
            URL.revokeObjectURL(blobUrl);
            reject(error);
          }
        };
        
        img.onerror = () => {
          // Clean up blob URL on error
          URL.revokeObjectURL(blobUrl);
          reject(new Error('Failed to load image'));
        };
        
        img.src = blobUrl;
      });
    } catch (error) {
      throw new Error(`Failed to analyze template: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Analyze a PNG template to detect photo placement holes (deprecated - use analyzeTemplateByFileId)
   */
  async analyzeTemplate(imageUrl: string): Promise<TemplateAnalysisResult> {
    // Extract file ID from Google Drive URL if possible
    const fileIdMatch = imageUrl.match(/\/files\/([a-zA-Z0-9-_]+)/);
    if (fileIdMatch) {
      return this.analyzeTemplateByFileId(fileIdMatch[1]);
    }
    
    throw new Error('Please use analyzeTemplateByFileId for Google Drive files');
  }

  /**
   * Create a blob URL from a Google Drive file ID (handles authentication properly)
   */
  private async createBlobUrlFromFileId(fileId: string): Promise<string> {
    try {
      // Import the googleDriveService to download the file properly
      const { googleDriveService } = await import('./googleDriveService');
      const blob = await googleDriveService.downloadPhoto(fileId);
      return URL.createObjectURL(blob);
    } catch (error) {
      throw new Error(`Failed to download file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Detect placeholder regions and convert them to hole coordinates
   */
  private detectPlaceholderRegions(imageData: ImageData): TemplateHole[] {
    const { width, height, data } = imageData;
    
    // First, try to detect if this is a photocard layout (edge-to-edge placeholder areas)
    // Temporarily disable photocard detection to test if it's interfering
    const ENABLE_PHOTOCARD_DETECTION = false; // Set to true to enable
    
    if (ENABLE_PHOTOCARD_DETECTION && this.isPhotocardLayout(imageData)) {
      console.log('🎴 Detected photocard layout - using grid-based detection');
      return this.detectPhotocardHoles(imageData);
    }
    
    // Use regular flood-fill detection for other layouts
    const visited = new Set<string>();
    const holes: TemplateHole[] = [];

    // Scan for magenta pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;

        if (this.isPlaceholderPixel(data, x, y, width)) {
          const bounds = this.floodFillBounds(imageData, x, y, visited);
          
          // Get precise hole dimensions by finding the actual placeholder boundaries
          const preciseBounds = this.getPreciseHoleBounds(imageData, bounds);
          const holeWidth = preciseBounds.width;
          const holeHeight = preciseBounds.height;
          
          // DEBUG: Log actual vs precise bounds
          console.log(`🔍 HOLE DETECTION DEBUG:`, {
            roughBounds: { 
              x: bounds.minX, y: bounds.minY, 
              width: bounds.maxX - bounds.minX + 1, 
              height: bounds.maxY - bounds.minY + 1 
            },
            preciseBounds: preciseBounds,
            aspectRatio: (preciseBounds.width / preciseBounds.height).toFixed(2)
          });
          
          if (holeWidth >= TemplateDetectionService.MIN_HOLE_SIZE && 
              holeHeight >= TemplateDetectionService.MIN_HOLE_SIZE) {
            
            // Check if this is a cross-shaped region that needs to be split
            const splitHoles = this.splitCrossRegion(bounds, imageData);
            
            if (splitHoles.length > 1) {
              // Add all split holes
              splitHoles.forEach(hole => {
                holes.push({
                  id: `hole_${holes.length + 1}`,
                  x: hole.x,
                  y: hole.y,
                  width: hole.width,
                  height: hole.height
                });
              });
            } else {
              // Add as single hole
              const hole = {
                id: `hole_${holes.length + 1}`,
                x: preciseBounds.x,
                y: preciseBounds.y,
                width: preciseBounds.width,
                height: preciseBounds.height
              };
              
              console.log(`🎯 Precise hole detected: ${hole.id} at (${hole.x},${hole.y}) size ${hole.width}×${hole.height}px`);
              holes.push(hole);
            }
          }
        }
      }
    }

    // Sort holes by position (top-to-bottom, left-to-right)
    holes.sort((a, b) => {
      if (Math.abs(a.y - b.y) < 20) { // Same row
        return a.x - b.x;
      }
      return a.y - b.y;
    });

    // Reassign IDs based on sorted order
    holes.forEach((hole, index) => {
      hole.id = `hole_${index + 1}`;
    });

    return holes;
  }

  /**
   * Detect if this is a photocard layout (edge-to-edge placeholder areas touching borders)
   */
  private isPhotocardLayout(imageData: ImageData): boolean {
    const { width, height, data } = imageData;
    
    // Check if there are significant placeholder areas touching the edges
    let edgePlaceholderPixels = 0;
    let totalPlaceholderPixels = 0;
    
    // Sample edge pixels
    const edgePixelsToCheck = [
      // Top edge
      ...Array.from({length: Math.min(width, 100)}, (_, i) => ({x: i * Math.floor(width/100), y: 0})),
      // Bottom edge  
      ...Array.from({length: Math.min(width, 100)}, (_, i) => ({x: i * Math.floor(width/100), y: height-1})),
      // Left edge
      ...Array.from({length: Math.min(height, 100)}, (_, i) => ({x: 0, y: i * Math.floor(height/100)})),
      // Right edge
      ...Array.from({length: Math.min(height, 100)}, (_, i) => ({x: width-1, y: i * Math.floor(height/100)})),
    ];
    
    // Count placeholder pixels on edges
    for (const {x, y} of edgePixelsToCheck) {
      if (this.isPlaceholderPixel(data, x, y, width)) {
        edgePlaceholderPixels++;
      }
    }
    
    // Sample total placeholder pixels (every 10th pixel for performance)
    for (let y = 0; y < height; y += 10) {
      for (let x = 0; x < width; x += 10) {
        if (this.isPlaceholderPixel(data, x, y, width)) {
          totalPlaceholderPixels++;
        }
      }
    }
    
    // If more than 20% of edge samples are placeholder areas, likely a photocard
    const edgePlaceholderRatio = edgePlaceholderPixels / edgePixelsToCheck.length;
    const isPhotocard = edgePlaceholderRatio > 0.2 && totalPlaceholderPixels > 100;
    
    console.log('🎴 Photocard detection:', {
      edgePlaceholderPixels,
      totalEdgePixels: edgePixelsToCheck.length,
      edgePlaceholderRatio: edgePlaceholderRatio.toFixed(3),
      totalPlaceholderPixels,
      isPhotocard
    });
    
    return isPhotocard;
  }

  /**
   * Detect holes in photocard layout using grid-based approach
   */
  private detectPhotocardHoles(imageData: ImageData): TemplateHole[] {
    const { width, height, data } = imageData;
    const holes: TemplateHole[] = [];
    
    // Try different grid configurations (2x2, 2x3, 3x2, etc.)
    const gridConfigs = [
      {rows: 2, cols: 2}, // 2x2 grid
      {rows: 2, cols: 3}, // 2x3 grid
      {rows: 3, cols: 2}, // 3x2 grid
      {rows: 1, cols: 4}, // 1x4 strip
      {rows: 4, cols: 1}, // 4x1 strip
    ];
    
    let bestConfig = null;
    let bestScore = 0;
    
    // Test each grid configuration
    for (const config of gridConfigs) {
      const score = this.testGridConfiguration(imageData, config);
      if (score > bestScore) {
        bestScore = score;
        bestConfig = config;
      }
    }
    
    if (bestConfig && bestScore > 0.5) {
      console.log(`🎯 Best grid configuration: ${bestConfig.rows}x${bestConfig.cols} (score: ${bestScore.toFixed(3)})`);
      
      // Create holes based on the best grid
      const cellWidth = width / bestConfig.cols;
      const cellHeight = height / bestConfig.rows;
      
      for (let row = 0; row < bestConfig.rows; row++) {
        for (let col = 0; col < bestConfig.cols; col++) {
          const x = Math.round(col * cellWidth);
          const y = Math.round(row * cellHeight);
          const w = Math.round(cellWidth);
          const h = Math.round(cellHeight);
          
          holes.push({
            id: `hole_${holes.length + 1}`,
            x: x,
            y: y,
            width: w,
            height: h
          });
          
          console.log(`🎴 Photocard hole ${holes.length}: (${x},${y}) ${w}×${h}px`);
        }
      }
    }
    
    return holes;
  }

  /**
   * Test how well a grid configuration fits the placeholder regions
   */
  private testGridConfiguration(imageData: ImageData, config: {rows: number, cols: number}): number {
    const { width, height, data } = imageData;
    const cellWidth = width / config.cols;
    const cellHeight = height / config.rows;
    
    let placeholderInCells = 0;
    let totalSamples = 0;
    
    // Sample the center of each grid cell
    for (let row = 0; row < config.rows; row++) {
      for (let col = 0; col < config.cols; col++) {
        const centerX = Math.round(col * cellWidth + cellWidth / 2);
        const centerY = Math.round(row * cellHeight + cellHeight / 2);
        
        // Sample multiple points around the center
        const samplePoints = [
          {x: centerX, y: centerY},
          {x: centerX - 20, y: centerY},
          {x: centerX + 20, y: centerY},
          {x: centerX, y: centerY - 20},
          {x: centerX, y: centerY + 20},
        ];
        
        for (const point of samplePoints) {
          if (point.x >= 0 && point.x < width && point.y >= 0 && point.y < height) {
            totalSamples++;
            if (this.isPlaceholderPixel(data, point.x, point.y, width)) {
              placeholderInCells++;
            }
          }
        }
      }
    }
    
    const score = totalSamples > 0 ? placeholderInCells / totalSamples : 0;
    console.log(`🧪 Grid ${config.rows}x${config.cols}: ${placeholderInCells}/${totalSamples} = ${score.toFixed(3)}`);
    
    return score;
  }

  /**
   * Split a cross-shaped region into separate rectangular holes by finding individual placeholder areas
   */
  private splitCrossRegion(bounds: Rectangle, imageData: ImageData): Array<{x: number; y: number; width: number; height: number}> {
    const { data, width } = imageData;
    const { minX, minY, maxX, maxY } = bounds;
    
    // Check if this region has a cross shape by analyzing the placeholder distribution
    const regionWidth = maxX - minX;
    const regionHeight = maxY - minY;
    
    // Only attempt to split regions that are large enough to contain multiple holes
    if (regionWidth < 100 || regionHeight < 100) {
      return []; // Return empty to use original bounds
    }
    
    // Find individual holes by scanning for separate placeholder regions within the bounds
    const foundHoles: Array<{x: number; y: number; width: number; height: number}> = [];
    const visited = new Set<string>();
    
    // Scan the entire region for separate placeholder areas
    for (let y = minY; y <= maxY; y += 10) { // Sample every 10 pixels for performance
      for (let x = minX; x <= maxX; x += 10) {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        
        if (this.isPlaceholderPixel(data, x, y, width)) {
          // Found a placeholder pixel, flood fill to find this individual hole
          const holeBounds = this.floodFillBounds(imageData, x, y, visited);
          const preciseHole = this.getPreciseHoleBounds(imageData, holeBounds);
          
          // Only include if it's a reasonable hole size
          if (preciseHole.width >= TemplateDetectionService.MIN_HOLE_SIZE && 
              preciseHole.height >= TemplateDetectionService.MIN_HOLE_SIZE) {
            foundHoles.push(preciseHole);
          }
        }
      }
    }
    
    // Return individual holes if we found multiple, otherwise return empty for original bounds
    return foundHoles.length > 1 ? foundHoles : [];
  }

  /**
   * Get precise hole bounds by scanning pixel by pixel for exact placeholder boundaries
   */
  private getPreciseHoleBounds(imageData: ImageData, roughBounds: Rectangle): {x: number; y: number; width: number; height: number} {
    const { data, width } = imageData;
    
    // Find EXACT boundaries by scanning pixel by pixel
    let minX = roughBounds.maxX;
    let maxX = roughBounds.minX;
    let minY = roughBounds.maxY;
    let maxY = roughBounds.minY;
    
    // Scan EVERY pixel in the rough bounds to find exact placeholder edges
    for (let y = roughBounds.minY; y <= roughBounds.maxY; y++) {
      for (let x = roughBounds.minX; x <= roughBounds.maxX; x++) {
        if (this.isPlaceholderPixel(data, x, y, width)) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    const result = {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
    
    console.log(`🎯 PRECISE BOUNDS:`, {
      rough: { 
        x: roughBounds.minX, y: roughBounds.minY, 
        w: roughBounds.maxX - roughBounds.minX + 1, 
        h: roughBounds.maxY - roughBounds.minY + 1 
      },
      precise: result,
      aspectRatio: (result.width / result.height).toFixed(2)
    });
    
    return result;
  }

  /**
   * Check if a pixel is magenta within tolerance (supports multiple magenta colors)
   */
  private isPlaceholderPixel(data: Uint8ClampedArray, x: number, y: number, width: number): boolean {
    const index = (y * width + x) * 4;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];

    // Skip transparent pixels
    if (a < 128) return false;

    const tolerance = TemplateDetectionService.COLOR_TOLERANCE;

    // Check against all supported magenta colors
    return TemplateDetectionService.PLACEHOLDER_COLORS.some(([targetR, targetG, targetB]) => {
      return (
        Math.abs(r - targetR) <= tolerance &&
        Math.abs(g - targetG) <= tolerance &&
        Math.abs(b - targetB) <= tolerance
      );
    });
  }

  /**
   * Flood fill to find the bounds of a placeholder region
   */
  private floodFillBounds(
    imageData: ImageData, 
    startX: number, 
    startY: number, 
    visited: Set<string>
  ): Rectangle {
    const { width, height, data } = imageData;
    const stack: Point[] = [{ x: startX, y: startY }];
    const bounds: Rectangle = {
      minX: startX,
      minY: startY,
      maxX: startX,
      maxY: startY
    };

    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const key = `${x},${y}`;

      if (visited.has(key) || x < 0 || x >= width || y < 0 || y >= height) {
        continue;
      }

      if (!this.isPlaceholderPixel(data, x, y, width)) {
        continue;
      }

      visited.add(key);

      // Update bounds
      bounds.minX = Math.min(bounds.minX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.maxY = Math.max(bounds.maxY, y);

      // Add neighboring pixels
      stack.push(
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 }
      );
    }

    return bounds;
  }

  /**
   * Determine template type based on filename and hole count - using dynamic database configuration
   */
  private async determineTemplateType(holes: TemplateHole[], filename?: string): Promise<string> {
    console.log('🔍 TEMPLATE TYPE DETECTION:', {
      filename,
      holeCount: holes.length,
      holes: holes.map(h => ({ id: h.id, size: `${h.width}×${h.height}` }))
    });
    
    try {
      // Load available template types from database
      const availableTypes = await templateConfigService.getTemplateTypes();
      console.log('📋 Available template types from database:', availableTypes);
      
      if (availableTypes.length === 0) {
        console.warn('⚠️ No template types found in database, using generic fallback');
        return 'custom';
      }
      
      // First try to detect from filename using dynamic keywords
      if (filename) {
        const name = filename.toLowerCase();
        console.log('📝 Checking filename keywords for:', name);
        
        // Check against each available template type and its common keywords
        for (const templateType of availableTypes) {
          const typeKeywords = this.getTemplateTypeKeywords(templateType.name);
          
          for (const keyword of typeKeywords) {
            if (name.includes(keyword.toLowerCase())) {
              console.log(`✅ Detected ${templateType.name.toUpperCase()} from filename keyword: ${keyword}`);
              return templateType.name;
            }
          }
        }
        
        console.log('⚠️ No filename keywords matched available types, falling back to hole count detection');
      }
      
      // Fallback to hole count detection with dynamic types
      const holeCount = holes.length;
      console.log('🔢 Using hole count detection:', holeCount, 'holes');
      
      // Create a mapping of hole count to most likely template types
      const typeMapping = this.createHoleCountMapping(availableTypes.map(t => t.name), holeCount);
      
      if (typeMapping.length > 0) {
        const detectedType = typeMapping[0]; // Use first (most likely) match
        console.log(`✅ Detected ${detectedType.toUpperCase()} from hole count mapping`);
        return detectedType;
      }
      
      // Final fallback - use first available type
      const fallbackType = availableTypes[0].name;
      console.log(`⚠️ Using database fallback: ${holeCount} holes → ${fallbackType}`);
      return fallbackType;
    } catch (error) {
      console.error('❌ Error loading template types from database:', error);
      // Ultimate fallback
      return 'custom';
    }
  }
  
  /**
   * Get common keywords for a template type
   */
  private getTemplateTypeKeywords(templateType: string): string[] {
    const baseKeywords = [templateType]; // Always include the type name itself
    
    // Add common variations based on type name
    const variations: Record<string, string[]> = {
      'solo': ['solo', 'single', 'one'],
      'collage': ['collage', 'grid', 'multi'],
      'photocard': ['photocard', 'photo-card', 'card'],
      'photostrip': ['photostrip', 'photo-strip', 'strip'],
      'portrait': ['portrait', 'vertical'],
      'landscape': ['landscape', 'horizontal'],
      'square': ['square']
    };
    
    // Check if we have predefined variations
    const typeVariations = variations[templateType.toLowerCase()];
    if (typeVariations) {
      return [...baseKeywords, ...typeVariations];
    }
    
    // For unknown types, try to infer keywords from the name
    const inferredKeywords = [
      templateType,
      templateType.replace(/[_-]/g, ''), // Remove separators
      templateType.split(/[_-]/).join(' '), // Replace separators with spaces
    ];
    
    return [...baseKeywords, ...inferredKeywords];
  }
  
  /**
   * Create a mapping of hole count to likely template types
   */
  private createHoleCountMapping(availableTypes: string[], holeCount: number): string[] {
    const mapping: string[] = [];
    
    // Common hole count patterns (prioritized by likelihood)
    const patterns: Record<number, string[]> = {
      1: ['solo', 'single', 'portrait', 'landscape'],
      2: ['dual', 'double', 'pair'],
      3: ['triple', 'trio'],
      4: ['collage', 'quad', 'photocard', 'grid'],
      6: ['photostrip', 'strip', 'hex'],
      8: ['octo', 'grid'],
      9: ['grid', 'nine']
    };
    
    const likelyPatterns = patterns[holeCount] || [];
    
    // Find available types that match the patterns
    for (const pattern of likelyPatterns) {
      for (const availableType of availableTypes) {
        if (availableType.toLowerCase().includes(pattern.toLowerCase()) || 
            pattern.toLowerCase().includes(availableType.toLowerCase())) {
          if (!mapping.includes(availableType)) {
            mapping.push(availableType);
          }
        }
      }
    }
    
    // If no patterns match, add all available types as potential matches
    if (mapping.length === 0) {
      mapping.push(...availableTypes);
    }
    
    console.log(`🎯 Hole count ${holeCount} mapped to types:`, mapping);
    return mapping;
  }

  /**
   * Detect if template has internal branding (text inside photo areas)
   */
  private detectInternalBranding(imageData: ImageData, holes: TemplateHole[]): boolean {
    // Simple heuristic: templates with many holes or square aspect ratios likely have internal branding
    const holeCount = holes.length;
    
    if (holeCount >= 4) {
      // Calculate average aspect ratio of holes
      const avgAspectRatio = holes.reduce((sum, hole) => {
        return sum + (hole.width / hole.height);
      }, 0) / holes.length;
      
      // Square-ish holes (aspect ratio close to 1) often indicate photocard-style templates
      const isSquareish = avgAspectRatio > 0.7 && avgAspectRatio < 1.3;
      return isSquareish;
    }
    
    // For other templates, assume external branding
    return false;
  }

  /**
   * Validate template analysis results
   */
  validateTemplate(result: TemplateAnalysisResult): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if holes were found
    if (result.holes.length === 0) {
      errors.push('No photo placement areas detected. Ensure magenta (#FF00FF) regions are present.');
    }

    // Check hole sizes
    result.holes.forEach((hole, index) => {
      if (hole.width < TemplateDetectionService.MIN_HOLE_SIZE || 
          hole.height < TemplateDetectionService.MIN_HOLE_SIZE) {
        errors.push(`Hole ${index + 1} is too small (${hole.width}x${hole.height}px). Minimum size is ${TemplateDetectionService.MIN_HOLE_SIZE}px.`);
      }
    });

    // Check for overlapping holes
    for (let i = 0; i < result.holes.length; i++) {
      for (let j = i + 1; j < result.holes.length; j++) {
        if (this.holesOverlap(result.holes[i], result.holes[j])) {
          errors.push(`Holes ${i + 1} and ${j + 1} overlap. Ensure photo areas are separated.`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if two holes overlap
   */
  private holesOverlap(hole1: TemplateHole, hole2: TemplateHole): boolean {
    return !(
      hole1.x + hole1.width < hole2.x ||
      hole2.x + hole2.width < hole1.x ||
      hole1.y + hole1.height < hole2.y ||
      hole2.y + hole2.height < hole1.y
    );
  }
}

// Export singleton instance
export const templateDetectionService = new TemplateDetectionService();