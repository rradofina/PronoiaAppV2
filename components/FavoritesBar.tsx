import React, { useEffect, useRef } from 'react';
import { Photo } from '../types';
import { assessClippingRisk, showClippingWarning, addViewportDebugInfo } from '../utils/clippingDetection';

interface FavoritesBarProps {
  favoritedPhotos: Photo[];
  onPhotoClick: (photo: Photo) => void;
  onRemoveFavorite: (photoId: string) => void;
  isActiveInteractionArea?: boolean; // New prop to indicate when this is the active area
  layout?: 'horizontal' | 'vertical'; // New prop to control layout
  showRemoveButtons?: boolean; // New prop to control remove button visibility
  usedPhotoIds?: Set<string>; // New prop to track which photos are already used
  isExpanded?: boolean; // New prop to control expanded state with animations
  // Viewport-aware expansion props
  dynamicHeight?: string; // Dynamic height class (e.g., 'h-48', 'h-[200px]')
  adaptivePhotoSize?: 'small' | 'medium' | 'large'; // Adaptive photo sizing
  maxPhotosToShow?: number; // Limit photos shown based on viewport
}

export default function FavoritesBar({
  favoritedPhotos,
  onPhotoClick,
  onRemoveFavorite,
  isActiveInteractionArea = false,
  layout = 'horizontal',
  showRemoveButtons = true,
  usedPhotoIds = new Set(),
  isExpanded = false,
  dynamicHeight,
  adaptivePhotoSize = 'medium',
  maxPhotosToShow
}: FavoritesBarProps) {
  
  // Apply adaptive photo limiting
  const displayPhotos = maxPhotosToShow ? favoritedPhotos.slice(0, maxPhotosToShow) : favoritedPhotos;
  
  // CLIPPING PREVENTION: Calculate safe viewport dimensions
  const getSafeViewportInfo = () => {
    if (typeof window === 'undefined') return { height: 800, isSafeForExpansion: true };
    
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const headerSpace = 160; // Conservative estimate for header + controls
    const minimumContentSpace = 300; // Minimum space for main content
    const safetyMargin = 60; // Extra safety margin for system UI
    
    const availableForExpansion = viewportHeight - headerSpace - minimumContentSpace - safetyMargin;
    const isSafeForExpansion = availableForExpansion >= 120; // At least h-30 worth of space
    
    return { 
      height: viewportHeight, 
      availableForExpansion: Math.max(96, availableForExpansion), // Never below h-24
      isSafeForExpansion 
    };
  };
  
  const safeViewport = getSafeViewportInfo();
  
  // Get adaptive photo height based on size with clipping prevention
  const getAdaptivePhotoHeight = () => {
    if (!isExpanded) return 'h-16'; // Always h-16 when collapsed
    
    // CLIPPING PREVENTION: Adjust photo size based on available space
    const basePhotoHeight = (() => {
      switch (adaptivePhotoSize) {
        case 'small': return 128; // h-32
        case 'medium': return 160; // h-40
        case 'large': return 192; // h-48
        default: return 160;
      }
    })();
    
    // Don't allow photos to exceed 60% of available expansion space
    const maxAllowedPhotoHeight = safeViewport.availableForExpansion * 0.6;
    const safePhotoHeight = Math.min(basePhotoHeight, maxAllowedPhotoHeight);
    
    // Convert back to Tailwind classes with fallback
    if (safePhotoHeight <= 96) return 'h-24';
    if (safePhotoHeight <= 128) return 'h-32';
    if (safePhotoHeight <= 160) return 'h-40';
    if (safePhotoHeight <= 192) return 'h-48';
    return `h-[${Math.round(safePhotoHeight)}px]`;
  };
  
  // CLIPPING PREVENTION: Safe container height calculation
  const getSafeContainerHeight = () => {
    if (!isExpanded) return 'h-24';
    
    // If viewport is too constrained, don't expand
    if (!safeViewport.isSafeForExpansion) {
      console.warn('🚨 CLIPPING PREVENTION: Viewport too constrained for favorites bar expansion', {
        viewportHeight: safeViewport.height,
        availableSpace: safeViewport.availableForExpansion,
        recommendedAction: 'Keeping collapsed to prevent clipping'
      });
      return 'h-24';
    }
    
    // Use provided dynamic height if it's safe
    if (dynamicHeight) {
      const dynamicHeightValue = parseInt(dynamicHeight.replace(/[^\d]/g, '')) || 256;
      if (dynamicHeightValue <= safeViewport.availableForExpansion) {
        return dynamicHeight;
      } else {
        console.warn('🚨 CLIPPING PREVENTION: Dynamic height would cause clipping', {
          requestedHeight: dynamicHeightValue,
          availableSpace: safeViewport.availableForExpansion,
          fallbackHeight: safeViewport.availableForExpansion
        });
      }
    }
    
    // Calculate safe height from available space
    const safeHeight = Math.min(safeViewport.availableForExpansion, 280); // Cap at 280px
    
    // Convert to Tailwind classes
    if (safeHeight <= 96) return 'h-24';
    if (safeHeight <= 128) return 'h-32';
    if (safeHeight <= 160) return 'h-40';
    if (safeHeight <= 192) return 'h-48';
    if (safeHeight <= 224) return 'h-56';
    if (safeHeight <= 256) return 'h-64';
    if (safeHeight <= 288) return 'h-72';
    return `h-[${Math.round(safeHeight)}px]`;
  };
  
  const containerHeight = getSafeContainerHeight();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // DEVELOPMENT: Clipping monitoring and warnings
  useEffect(() => {
    if (!isExpanded || !containerRef.current) return;
    
    const containerElement = containerRef.current;
    const containerHeightPx = containerElement.getBoundingClientRect().height;
    
    // Assess clipping risk
    const clippingRisk = assessClippingRisk(containerHeightPx, {
      headerHeight: 140,
      contentHeight: 420,
      padding: 60
    });
    
    // Show warning for high-risk scenarios
    showClippingWarning(clippingRisk);
    
    // Add debug info in development
    if (process.env.NODE_ENV === 'development') {
      addViewportDebugInfo(containerElement);
    }
    
    // Log clipping assessment
    if (clippingRisk.level !== 'none') {
      console.warn('📏 FavoritesBar clipping assessment:', {
        containerHeight: containerHeightPx,
        risk: clippingRisk,
        isExpanded,
        layout
      });
    }
  }, [isExpanded, containerHeight, layout]);
  
  // Note: Enhanced viewport-aware expansion with clipping prevention
  
  if (displayPhotos.length === 0) {
    return (
      <div className={`flex items-center justify-center transition-all duration-300 ease-in-out ${
        layout === 'horizontal' 
          ? `${containerHeight} border-t`
          : 'h-full'
      } ${
        isActiveInteractionArea 
          ? 'bg-yellow-50 border-yellow-300 border-t-2' 
          : isExpanded && layout === 'horizontal'
          ? 'bg-blue-50 border-blue-300 border-t-2'
          : 'bg-gray-100'
      }`}>
        <div className={`text-center ${
          isActiveInteractionArea ? 'text-yellow-600' : 'text-gray-500'
        }`}>
          <div className="text-2xl mb-1">⭐</div>
          <p className="text-sm">
            {isActiveInteractionArea 
              ? 'Select a favorite photo to fill the template slot'
              : 'No favorites yet - star photos to add them here'
            }
          </p>
        </div>
      </div>
    );
  }

  if (layout === 'horizontal') {
    // Horizontal layout (original mobile/tablet design) with viewport-aware expansion
    return (
      <div 
        ref={containerRef}
        className={`border-t overflow-hidden transition-all duration-300 ease-in-out favorites-bar-safe ${
          containerHeight
        } ${
          isActiveInteractionArea 
            ? 'bg-yellow-50 border-yellow-300 border-t-2 shadow-lg' 
            : isExpanded
            ? 'bg-blue-50 border-blue-300 border-t-2 shadow-lg'
            : 'bg-white'
        }`}
        style={{
          // CSS SAFETY: Add viewport-based max height to prevent clipping
          maxHeight: '100vh',
          // CSS SAFETY: Add fallback overflow handling
          overflowY: 'auto'
        }}
      >
        <div className="h-full flex flex-col">
          {/* Header section with title */}
          <div className={`flex-shrink-0 px-3 py-2 text-sm font-medium border-b border-opacity-20 ${
            isActiveInteractionArea ? 
              'text-yellow-700 font-bold border-yellow-400' : 
              isExpanded ? 
                'text-blue-700 font-bold border-blue-400' : 
                'text-gray-700 border-gray-300'
          }`}>
            {isActiveInteractionArea ? '⚡ ' : isExpanded ? '📌 ' : ''}Favorites ({favoritedPhotos.length})
            {isActiveInteractionArea && <div className="text-xs text-yellow-600">Tap to fill slot</div>}
            {isExpanded && !isActiveInteractionArea && <div className="text-xs text-blue-600">Slot selected - choose photo</div>}
          </div>
          
          {/* Photos section - takes remaining space */}
          <div className="flex-1 overflow-x-auto flex items-center">
            <div className={`flex px-3 py-3 transition-all duration-300 ease-in-out ${
              isExpanded ? 'space-x-4' : 'space-x-2'
            }`} style={{ touchAction: 'pan-x' }}>
              {displayPhotos.map((photo) => {
                const isUsed = usedPhotoIds.has(photo.id);
                return (
                  <div
                    key={photo.id}
                    className="flex-shrink-0 relative group cursor-pointer"
                    onClick={() => onPhotoClick(photo)}
                  >
                    <div className={`rounded-lg overflow-hidden border-2 transition-all duration-300 ease-in-out ${
                      getAdaptivePhotoHeight()
                    } ${
                      isUsed
                        ? 'border-green-400 shadow-md' // Used photos get green border
                        : isActiveInteractionArea 
                        ? 'border-yellow-400 hover:border-yellow-500 shadow-md hover:shadow-lg hover:scale-105' 
                        : isExpanded
                        ? 'border-blue-400 hover:border-blue-500 shadow-md hover:shadow-lg hover:scale-105'
                        : 'border-gray-200 hover:border-blue-400'
                    }`} style={{
                      width: isExpanded ? 'auto' : '64px',
                      aspectRatio: isExpanded ? 'auto' : '1'
                    }}>
                      <img
                        src={photo.thumbnailUrl || photo.url}
                        alt={photo.name}
                        className={`w-full h-full object-cover transition-opacity duration-200 ${
                          isUsed ? 'opacity-60' : 'opacity-100'
                        }`}
                      />
                      
                      {/* Used indicator overlay */}
                      {isUsed && (
                        <div className="absolute inset-0 bg-green-600 bg-opacity-20 flex items-center justify-center">
                          <div className="bg-green-600 text-white text-xs px-1 rounded font-medium">
                            Used
                          </div>
                        </div>
                      )}
                    </div>
                  
                  {/* Remove button on hover - conditional */}
                  {showRemoveButtons && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFavorite(photo.id);
                      }}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove from favorites"
                    >
                      ×
                    </button>
                  )}
                  
                  {/* Star indicator */}
                  <div className={`absolute bottom-0 right-0 bg-yellow-500 text-white rounded-full flex items-center justify-center transition-all duration-300 ease-in-out ${
                    isExpanded ? 'w-6 h-6 text-base' : 'w-4 h-4 text-xs'
                  }`}>
                    ⭐
                  </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    // Vertical layout (desktop grid design) with expansion support
    return (
      <div 
        className={`h-full transition-all duration-300 ease-in-out ${
          isActiveInteractionArea 
            ? 'bg-yellow-50 border-yellow-300 shadow-lg' 
            : isExpanded
            ? 'bg-blue-50 border-blue-300 shadow-lg'
            : 'bg-white'
        }`}
        style={{
          // CSS SAFETY: Add viewport-based max height to prevent clipping
          maxHeight: '100vh',
          // CSS SAFETY: Add fallback overflow handling
          overflowY: 'auto'
        }}
      >
        <div className={`grid gap-2 p-4 transition-all duration-300 ease-in-out ${
          isExpanded ? 'grid-cols-2 gap-3' : 'grid-cols-3 gap-2'
        }`}>
          {displayPhotos.map((photo) => {
            const isUsed = usedPhotoIds.has(photo.id);
            return (
              <div
                key={photo.id}
                className="relative cursor-pointer group transition-all duration-300 ease-in-out"
                onClick={() => onPhotoClick(photo)}
                style={{
                  aspectRatio: isExpanded ? 'auto' : '1'
                }}
              >
                <div className={`w-full rounded-lg overflow-hidden border-2 transition-all duration-300 ease-in-out ${
                  isExpanded ? 'h-auto' : 'h-full'
                } ${
                  isUsed
                    ? 'border-green-400 shadow-md' // Used photos get green border
                    : isActiveInteractionArea 
                    ? 'border-yellow-400 hover:border-yellow-500 shadow-md hover:shadow-lg hover:scale-105' 
                    : isExpanded
                    ? 'border-blue-400 hover:border-blue-500 shadow-md hover:shadow-lg hover:scale-105'
                    : 'border-gray-200 hover:border-blue-400'
                }`}>
                  <img
                    src={photo.thumbnailUrl || photo.url}
                    alt={photo.name}
                    className={`w-full h-full object-cover transition-opacity duration-200 ${
                      isUsed ? 'opacity-60' : 'opacity-100'
                    }`}
                  />
                  
                  {/* Used indicator overlay */}
                  {isUsed && (
                    <div className="absolute inset-0 bg-green-600 bg-opacity-20 flex items-center justify-center">
                      <div className="bg-green-600 text-white text-xs px-1 rounded font-medium">
                        Used
                      </div>
                    </div>
                  )}
                </div>
              
              {/* Remove button on hover - conditional */}
              {showRemoveButtons && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFavorite(photo.id);
                  }}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove from favorites"
                >
                  ×
                </button>
              )}
              
              {/* Star indicator */}
              <div className={`absolute bottom-0 right-0 bg-yellow-500 text-white rounded-full flex items-center justify-center transition-all duration-300 ease-in-out ${
                isExpanded ? 'w-5 h-5 text-sm' : 'w-4 h-4 text-xs'
              }`}>
                ⭐
              </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
}