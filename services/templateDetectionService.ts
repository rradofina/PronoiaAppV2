/**
 * Template Detection Service
 * Analyzes PNG files to automatically detect photo placement areas (holes) 
 * marked with magenta (#FF00FF) color regions
 */

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
  templateType: 'solo' | 'collage' | 'photocard' | 'photostrip';
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
  private static readonly MAGENTA_COLORS = [
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
        
        img.onload = () => {
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
            const holes = this.detectMagentaRegions(imageData);
            const templateType = this.determineTemplateType(holes, filename);
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
   * Detect magenta regions and convert them to hole coordinates
   */
  private detectMagentaRegions(imageData: ImageData): TemplateHole[] {
    const { width, height, data } = imageData;
    const visited = new Set<string>();
    const holes: TemplateHole[] = [];

    // Scan for magenta pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;

        if (this.isMagentaPixel(data, x, y, width)) {
          const bounds = this.floodFillBounds(imageData, x, y, visited);
          
          // Get precise hole dimensions by finding the actual magenta boundaries
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
   * Split a cross-shaped region into separate rectangular holes by finding individual magenta areas
   */
  private splitCrossRegion(bounds: RegionBounds, imageData: ImageData): Array<{x: number; y: number; width: number; height: number}> {
    const { data, width } = imageData;
    const { minX, minY, maxX, maxY } = bounds;
    
    // Check if this region has a cross shape by analyzing the magenta distribution
    const regionWidth = maxX - minX;
    const regionHeight = maxY - minY;
    
    // Only attempt to split regions that are large enough to contain multiple holes
    if (regionWidth < 100 || regionHeight < 100) {
      return []; // Return empty to use original bounds
    }
    
    // Find individual holes by scanning for separate magenta regions within the bounds
    const foundHoles: Array<{x: number; y: number; width: number; height: number}> = [];
    const visited = new Set<string>();
    
    // Scan the entire region for separate magenta areas
    for (let y = minY; y <= maxY; y += 10) { // Sample every 10 pixels for performance
      for (let x = minX; x <= maxX; x += 10) {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        
        if (this.isMagentaPixel(data, x, y, width)) {
          // Found a magenta pixel, flood fill to find this individual hole
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
   * Get precise hole bounds by scanning pixel by pixel for exact magenta boundaries
   */
  private getPreciseHoleBounds(imageData: ImageData, roughBounds: Rectangle): {x: number; y: number; width: number; height: number} {
    const { data, width } = imageData;
    
    // Find EXACT boundaries by scanning pixel by pixel
    let minX = roughBounds.maxX;
    let maxX = roughBounds.minX;
    let minY = roughBounds.maxY;
    let maxY = roughBounds.minY;
    
    // Scan EVERY pixel in the rough bounds to find exact magenta edges
    for (let y = roughBounds.minY; y <= roughBounds.maxY; y++) {
      for (let x = roughBounds.minX; x <= roughBounds.maxX; x++) {
        if (this.isMagentaPixel(data, x, y, width)) {
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
  private isMagentaPixel(data: Uint8ClampedArray, x: number, y: number, width: number): boolean {
    const index = (y * width + x) * 4;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];

    // Skip transparent pixels
    if (a < 128) return false;

    const tolerance = TemplateDetectionService.COLOR_TOLERANCE;

    // Check against all supported magenta colors
    return TemplateDetectionService.MAGENTA_COLORS.some(([targetR, targetG, targetB]) => {
      return (
        Math.abs(r - targetR) <= tolerance &&
        Math.abs(g - targetG) <= tolerance &&
        Math.abs(b - targetB) <= tolerance
      );
    });
  }

  /**
   * Flood fill to find the bounds of a magenta region
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

      if (!this.isMagentaPixel(data, x, y, width)) {
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
   * Determine template type based on filename and hole count
   */
  private determineTemplateType(holes: TemplateHole[], filename?: string): 'solo' | 'collage' | 'photocard' | 'photostrip' {
    // First try to detect from filename
    if (filename) {
      const name = filename.toLowerCase();
      
      // Look for keywords in filename
      if (name.includes('solo') || name.includes('single')) return 'solo';
      if (name.includes('collage') || name.includes('grid')) return 'collage';
      if (name.includes('photocard') || name.includes('photo-card') || name.includes('card')) return 'photocard';
      if (name.includes('strip') || name.includes('photo-strip') || name.includes('photostrip')) return 'photostrip';
    }
    
    // Fallback to hole count detection
    const holeCount = holes.length;

    if (holeCount === 1) {
      return 'solo';
    } else if (holeCount === 4) {
      // Check if it's a 2x2 grid (collage) or colored backgrounds (photocard)
      const avgWidth = holes.reduce((sum, hole) => sum + hole.width, 0) / holes.length;
      const avgHeight = holes.reduce((sum, hole) => sum + hole.height, 0) / holes.length;
      
      // If holes are more square-ish, likely photocard; if rectangular, likely collage
      const aspectRatio = avgWidth / avgHeight;
      return aspectRatio > 0.8 && aspectRatio < 1.2 ? 'photocard' : 'collage';
    } else if (holeCount === 6) {
      return 'photostrip';
    }

    // Default fallback
    return holeCount <= 2 ? 'solo' : holeCount <= 4 ? 'collage' : 'photostrip';
  }

  /**
   * Detect if template has internal branding (text inside photo areas)
   */
  private detectInternalBranding(imageData: ImageData, holes: TemplateHole[]): boolean {
    // For now, use template type as a proxy
    // Photocards typically have internal branding, others external
    const templateType = this.determineTemplateType(holes);
    return templateType === 'photocard' || templateType === 'photostrip';
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