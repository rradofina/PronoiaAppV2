import { Photo } from '../types';

// Dynamic debug mode - can be controlled via localStorage or URL params
function getDebugMode(): boolean {
  // Check if running in development
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Check URL parameters for debug flag
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('debugPhotos') === 'true') {
      return true;
    }
    
    // Check localStorage for persistent debug setting
    const localStorageDebug = localStorage.getItem('debugPhotoUrls');
    if (localStorageDebug === 'true') {
      return true;
    }
  }
  
  // Default to true in development, false in production
  return isDevelopment;
}

const DEBUG_URL_QUALITY = getDebugMode();

/**
 * Enable debug mode for photo URL investigation
 * Call this in browser console: enablePhotoUrlDebug()
 */
export function enablePhotoUrlDebug(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('debugPhotoUrls', 'true');
    console.log('🔧 Photo URL debug mode enabled. Reload the page to see detailed logging.');
  }
}

/**
 * Disable debug mode for photo URL investigation
 * Call this in browser console: disablePhotoUrlDebug()
 */
export function disablePhotoUrlDebug(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('debugPhotoUrls');
    console.log('🔇 Photo URL debug mode disabled. Reload the page to stop detailed logging.');
  }
}

/**
 * Show current debug status and instructions
 * Call this in browser console: showPhotoUrlDebugStatus()
 */
export function showPhotoUrlDebugStatus(): void {
  const isEnabled = getDebugMode();
  console.log(`📊 Photo URL Debug Status: ${isEnabled ? 'ENABLED' : 'DISABLED'}`);
  console.log('To enable:  enablePhotoUrlDebug()');
  console.log('To disable: disablePhotoUrlDebug()');
  console.log('Or add ?debugPhotos=true to URL for temporary debugging');
}

// Make debug functions available globally for console access
if (typeof window !== 'undefined') {
  (window as any).enablePhotoUrlDebug = enablePhotoUrlDebug;
  (window as any).disablePhotoUrlDebug = disablePhotoUrlDebug;
  (window as any).showPhotoUrlDebugStatus = showPhotoUrlDebugStatus;
}

/**
 * Analyze photo URL quality and log findings
 */
function analyzePhotoUrlQuality(photo: Photo, context: string = ''): void {
  if (!DEBUG_URL_QUALITY) return;
  
  console.group(`🔍 URL Quality Analysis ${context ? `(${context})` : ''} - ${photo.name}`);
  
  // Analyze main URL
  if (photo.url) {
    const urlInfo = analyzeUrl(photo.url, 'main URL');
    console.log('📄 Main URL:', urlInfo);
  } else {
    console.warn('❌ No main URL available');
  }
  
  // Analyze thumbnail URL
  if (photo.thumbnailUrl) {
    const thumbnailInfo = analyzeUrl(photo.thumbnailUrl, 'thumbnail URL');
    console.log('🖼️ Thumbnail URL:', thumbnailInfo);
  } else {
    console.warn('❌ No thumbnail URL available');
  }
  
  // Analyze Google Drive ID
  if (photo.googleDriveId) {
    console.log('☁️ Google Drive ID:', photo.googleDriveId);
  } else {
    console.warn('❌ No Google Drive ID available');
  }
  
  console.groupEnd();
}

/**
 * Analyze a single URL for quality indicators
 */
function analyzeUrl(url: string, label: string): any {
  const analysis = {
    url: url,
    type: 'unknown',
    quality: 'unknown',
    size: null as number | null,
    isGoogleDrive: false,
    isResizable: false,
    score: 0,
    isValid: false
  };
  
  // Basic URL validation
  try {
    new URL(url);
    analysis.isValid = true;
  } catch {
    analysis.isValid = false;
    analysis.quality = 'invalid';
    return analysis;
  }
  
  // Check if it's a Google Drive URL
  if (url.includes('googleusercontent.com')) {
    analysis.isGoogleDrive = true;
    analysis.type = 'Google Drive thumbnail';
    analysis.score += 50; // Base score for Google Drive
    
    // Extract size parameter
    const sizeMatch = url.match(/=s(\d+)/);
    if (sizeMatch) {
      analysis.size = parseInt(sizeMatch[1]);
      analysis.isResizable = true;
      
      // Determine quality and score based on size
      if (analysis.size >= 1600) {
        analysis.quality = 'very high';
        analysis.score += 100;
      } else if (analysis.size >= 1200) {
        analysis.quality = 'high';
        analysis.score += 80;
      } else if (analysis.size >= 800) {
        analysis.quality = 'medium-high';
        analysis.score += 60;
      } else if (analysis.size >= 600) {
        analysis.quality = 'medium';
        analysis.score += 40;
      } else if (analysis.size >= 400) {
        analysis.quality = 'low-medium';
        analysis.score += 20;
      } else {
        analysis.quality = 'low';
        analysis.score += 5;
      }
    } else {
      // No size parameter - assume original quality
      analysis.quality = 'original/unknown';
      analysis.score += 90;
    }
  } else if (url.includes('drive.google.com/uc')) {
    analysis.isGoogleDrive = true;
    analysis.type = 'Google Drive direct';
    analysis.quality = 'potentially very high';
    analysis.score += 95; // High score for direct access
  } else if (url.includes('drive.google.com')) {
    analysis.isGoogleDrive = true;
    analysis.type = 'Google Drive other';
    analysis.quality = 'unknown';
    analysis.score += 30;
  } else {
    analysis.type = 'external/other';
    analysis.quality = 'unknown';
    analysis.score += 10; // Low score for non-Google Drive URLs
  }
  
  return analysis;
}

/**
 * Score and sort URLs by quality
 */
function sortUrlsByQuality(urls: string[]): string[] {
  const urlsWithScores = urls.map(url => ({
    url,
    analysis: analyzeUrl(url, 'scoring')
  }));
  
  // Sort by score (highest first), then by validity
  urlsWithScores.sort((a, b) => {
    if (a.analysis.isValid !== b.analysis.isValid) {
      return a.analysis.isValid ? -1 : 1;
    }
    return b.analysis.score - a.analysis.score;
  });
  
  if (DEBUG_URL_QUALITY) {
    console.log('🏆 URL Quality Ranking:', urlsWithScores.map((item, index) => ({
      rank: index + 1,
      score: item.analysis.score,
      quality: item.analysis.quality,
      type: item.analysis.type,
      url: item.url.substring(0, 50) + '...'
    })));
  }
  
  return urlsWithScores.map(item => item.url);
}

/**
 * Validate that a photo has usable URLs
 */
function validatePhotoUrls(photo: Photo): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  if (!photo.url && !photo.thumbnailUrl && !photo.googleDriveId) {
    issues.push('No URLs or Google Drive ID available');
  }
  
  if (photo.thumbnailUrl && !isResizableGoogleDriveUrl(photo.thumbnailUrl)) {
    issues.push('Thumbnail URL is not resizable');
  }
  
  if (!photo.googleDriveId) {
    issues.push('Missing Google Drive ID for high-quality access');
  }
  
  // Check URL validity
  [photo.url, photo.thumbnailUrl].forEach((url, index) => {
    if (url) {
      try {
        new URL(url);
      } catch {
        issues.push(`${index === 0 ? 'Main' : 'Thumbnail'} URL is malformed`);
      }
    }
  });
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

/**
 * Get high-resolution URLs for a photo with fallback strategy
 * Prioritizes high quality for template editing and fullscreen viewing
 */
export function getHighResPhotoUrls(photo: Photo): string[] {
  analyzePhotoUrlQuality(photo, 'High-Res URL Generation');
  
  // Validate photo URLs first
  const validation = validatePhotoUrls(photo);
  if (!validation.isValid && DEBUG_URL_QUALITY) {
    console.warn(`⚠️ Photo validation issues for ${photo.name}:`, validation.issues);
  }
  
  const urls: string[] = [];
  
  // For high-resolution viewing (template editor, fullscreen), prioritize high quality
  if (photo.thumbnailUrl && isResizableGoogleDriveUrl(photo.thumbnailUrl)) {
    urls.push(photo.thumbnailUrl.replace('=s220', '=s1600')); // =s1600 (high res)
    urls.push(photo.thumbnailUrl.replace('=s220', '=s1200')); // =s1200 (good quality)
    urls.push(photo.thumbnailUrl.replace('=s220', '=s800'));  // =s800 (medium quality)
  } else if (photo.thumbnailUrl) {
    // If not resizable, just use as-is
    urls.push(photo.thumbnailUrl);
  }
  
  // Try lh3.googleusercontent.com/d/ format which often supports CORS
  if (photo.googleDriveId) {
    urls.push(`https://lh3.googleusercontent.com/d/${photo.googleDriveId}=w1600`);
    urls.push(`https://lh3.googleusercontent.com/d/${photo.googleDriveId}=w1200`);
  }
  
  // Try direct Google Drive link (may not support CORS)
  if (photo.googleDriveId) {
    urls.push(`https://drive.google.com/uc?id=${photo.googleDriveId}&export=view`);
  }
  
  // Use the original URL
  if (photo.url && !urls.includes(photo.url)) {
    urls.push(photo.url);
  }
  
  // Use thumbnail as last resort (but only if not already added)
  if (photo.thumbnailUrl && !urls.includes(photo.thumbnailUrl)) {
    urls.push(photo.thumbnailUrl); // =s220 (last resort)
  }
  
  const filteredUrls = urls.filter(Boolean);
  
  // Sort URLs by quality score
  const finalUrls = sortUrlsByQuality(filteredUrls);
  
  if (DEBUG_URL_QUALITY) {
    console.log(`📋 Generated ${finalUrls.length} high-res URLs for ${photo.name}:`);
  }
  
  return finalUrls;
}

/**
 * Get medium-resolution URLs for photo grids and previews
 * Balances quality with loading performance
 */
export function getMediumResPhotoUrls(photo: Photo): string[] {
  const urls: string[] = [];
  
  // For grid viewing, prioritize reasonable quality with good performance
  if (photo.thumbnailUrl && isResizableGoogleDriveUrl(photo.thumbnailUrl)) {
    urls.push(photo.thumbnailUrl.replace('=s220', '=s600')); // =s600 (good for grids)
    urls.push(photo.thumbnailUrl.replace('=s220', '=s400')); // =s400 (medium quality)
  } else if (photo.thumbnailUrl) {
    // If not resizable, use as-is
    urls.push(photo.thumbnailUrl);
  }
  
  // Use the original URL
  if (photo.url && !urls.includes(photo.url)) {
    urls.push(photo.url);
  }
  
  // Use thumbnail as fallback (only if not already added)
  if (photo.thumbnailUrl && !urls.includes(photo.thumbnailUrl)) {
    urls.push(photo.thumbnailUrl); // =s220 (fallback)
  }
  
  const filteredUrls = urls.filter(Boolean);
  
  // Sort URLs by quality score for consistent selection
  return sortUrlsByQuality(filteredUrls);
}

/**
 * Get the best single URL for a photo
 * Returns the first high-resolution URL available
 */
export function getBestPhotoUrl(photo: Photo): string {
  const urls = getHighResPhotoUrls(photo);
  const bestUrl = urls[0] || photo.url || photo.thumbnailUrl || '';
  
  if (DEBUG_URL_QUALITY) {
    console.log(`🎯 Best Photo URL selected for ${photo.name}:`, {
      selectedUrl: bestUrl.substring(0, 80) + '...',
      analysis: analyzeUrl(bestUrl, 'best URL'),
      totalOptions: urls.length
    });
  }
  
  return bestUrl;
}

/**
 * Get the best single URL for photo grids
 * Returns the first medium-resolution URL available
 */
export function getBestGridPhotoUrl(photo: Photo): string {
  analyzePhotoUrlQuality(photo, 'Grid URL Generation');
  
  const urls = getMediumResPhotoUrls(photo);
  const bestUrl = urls[0] || photo.url || photo.thumbnailUrl || '';
  
  if (DEBUG_URL_QUALITY) {
    console.log(`📊 Grid Photo URL selected for ${photo.name}:`, {
      selectedUrl: bestUrl.substring(0, 80) + '...',
      analysis: analyzeUrl(bestUrl, 'grid URL'),
      totalOptions: urls.length
    });
  }
  
  return bestUrl;
}

/**
 * Create a cache-busting URL by adding a timestamp parameter
 * Useful for forcing image re-loading
 */
export function addCacheBuster(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_t=${Date.now()}`;
}

/**
 * Check if a URL is a Google Drive thumbnail URL that can be resized
 */
export function isResizableGoogleDriveUrl(url: string): boolean {
  return url.includes('googleusercontent.com') && url.includes('=s');
}

/**
 * Resize a Google Drive thumbnail URL to a specific size
 */
export function resizeGoogleDriveUrl(url: string, size: number): string {
  if (!isResizableGoogleDriveUrl(url)) {
    return url;
  }
  return url.replace(/=s\d+/, `=s${size}`);
}