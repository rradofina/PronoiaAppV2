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
    if (typeof window === 'undefined') {
      return { 
        height: 800, 
        availableForExpansion: 200, // Default safe expansion for SSR
        isSafeForExpansion: true 
      };
    }
    
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
  
  // ADAPTIVE: Photo height based on expansion state and size preference
  const getAdaptivePhotoHeight = () => {
    if (isExpanded) {
      // Expanded mode: much larger photos for easier selection
      switch (adaptivePhotoSize) {
        case 'large': return 'h-64'; // 256px - maximizes space usage
        case 'medium': return 'h-48'; // 192px - balanced size
        case 'small': return 'h-32'; // 128px - compact but visible
        default: return 'h-56'; // 224px - good default for expanded view
      }
    }
    // Normal mode: standard size
    return 'h-24'; // 96px - perfect for 150px container with padding
  };
  
  // DYNAMIC: Container height based on expansion state
  const getContainerHeight = () => {
    if (!isExpanded) {
      return '150px'; // Fixed height when collapsed
    }
    // Expanded mode: take up more space for photo selection
    if (typeof window !== 'undefined') {
      const viewportHeight = window.innerHeight;
      const isMobile = viewportHeight < 768;
      const isTablet = viewportHeight >= 768 && viewportHeight < 1024;
      
      if (isMobile) {
        return '50vh'; // 50% of viewport on mobile
      } else if (isTablet) {
        return '40vh'; // 40% of viewport on tablet
      }
    }
    return '35vh'; // Default expansion height
  };
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
  }, [isExpanded, layout]);
  
  // Note: Enhanced viewport-aware expansion with clipping prevention
  
  if (displayPhotos.length === 0) {
    return (
      <div className={`flex items-center justify-center transition-all duration-300 ease-in-out ${
        layout === 'horizontal' 
          ? `h-full border-t`
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
        className={`fixed bottom-0 left-0 right-0 z-50 border-t overflow-hidden favorites-bar-safe transition-all duration-300 ${
          isActiveInteractionArea 
            ? 'bg-yellow-50 border-yellow-300 border-t-2' 
            : isExpanded
            ? 'bg-blue-50 border-blue-300 border-t-2'
            : 'bg-white'
        } ${
          isExpanded ? 'shadow-2xl' : 'shadow-lg'
        }`}
        style={{
          // Dynamic height based on expansion state
          height: getContainerHeight(),
          maxHeight: isExpanded ? '60vh' : '150px',
          // CSS SAFETY: Add fallback overflow handling
          overflowY: 'auto',
          // Smooth transition for height changes
          transition: 'height 300ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 300ms ease-out'
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
            {isActiveInteractionArea && isExpanded && <div className="text-xs font-bold text-yellow-700">Select a photo to fill the slot</div>}
            {isActiveInteractionArea && !isExpanded && <div className="text-xs text-yellow-600">Tap to fill slot</div>}
            {isExpanded && !isActiveInteractionArea && <div className="text-xs text-blue-600">Slot selected - choose photo</div>}
          </div>
          
          {/* Photos section - takes remaining space */}
          <div className="flex-1 overflow-x-auto flex items-center">
            <div className={`flex px-3 transition-all duration-300 ease-in-out ${
              isExpanded ? 'space-x-6 py-2' : 'space-x-2 py-3'
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
                        ? 'border-yellow-400 hover:border-yellow-500 shadow-lg hover:shadow-xl hover:scale-110 cursor-pointer' 
                        : isExpanded
                        ? 'border-blue-400 hover:border-blue-500 shadow-lg hover:shadow-xl hover:scale-110 cursor-pointer'
                        : 'border-gray-200 hover:border-blue-400'
                    }`} style={{
                      width: isExpanded ? 'auto' : '64px',
                      aspectRatio: isExpanded ? '3/4' : '1',
                      minWidth: isExpanded ? '192px' : 'auto'
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
                  <div className={`absolute bottom-1 right-1 bg-yellow-500 text-white rounded-full flex items-center justify-center transition-all duration-300 ease-in-out ${
                    isExpanded ? 'w-8 h-8 text-lg' : 'w-4 h-4 text-xs'
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
    // Vertical layout (desktop grid design) with proper scrolling
    return (
      <div 
        className={`h-full flex flex-col transition-all duration-300 ease-in-out ${
          isActiveInteractionArea 
            ? 'bg-yellow-50 border-yellow-300 shadow-lg' 
            : isExpanded
            ? 'bg-blue-50 border-blue-300 shadow-lg'
            : 'bg-white'
        }`}
      >
        {/* Header section (if needed for context) */}
        {displayPhotos.length > 9 && (
          <div className="flex-shrink-0 px-4 py-2 text-xs text-gray-600 border-b border-gray-200">
            {displayPhotos.length} photos • Scroll to see all
          </div>
        )}
        
        {/* Scrollable photos grid */}
        <div 
          className="flex-1 overflow-y-auto"
          style={{
            // Ensure smooth scrolling
            scrollBehavior: 'smooth',
            // Prevent momentum scrolling issues on iOS
            WebkitOverflowScrolling: 'touch'
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
      </div>
    );
  }
}