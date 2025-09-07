import React, { useState, useEffect, useRef } from 'react';
import { TemplateSlot, Photo } from '../types';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import { templateSyncService } from '../services/templateSyncService';
// import SyncStatusIndicator from './SyncStatusIndicator'; // Removed as redundant with global sync status

interface TemplateGridProps {
  templateSlots: TemplateSlot[];
  photos: Photo[];
  selectedSlot: TemplateSlot | null;
  onSlotClick: (slot: TemplateSlot) => void;
  onSwapTemplate?: (template: { templateId: string; templateName: string; slots: TemplateSlot[] }, index: number) => void;
  onDeleteTemplate?: (templateId: string) => void;
  onDownloadTemplate?: (template: { templateId: string; templateName: string; slots: TemplateSlot[] }) => void;
  TemplateVisual: React.ComponentType<any>;
  layout?: 'horizontal' | 'vertical' | 'main' | 'coverflow';
  showActions?: boolean;
  isEditingMode?: boolean;
  editingSlot?: TemplateSlot | null;
  onTemplateChange?: (templateIndex: number, templateId: string) => void;
  templateToNavigate?: string | null;
  onNavigationComplete?: () => void;
  initialIndex?: number;
}

function TemplateGrid({
  templateSlots,
  photos,
  selectedSlot,
  onSlotClick,
  onSwapTemplate,
  onDeleteTemplate,
  onDownloadTemplate,
  TemplateVisual,
  layout = 'horizontal',
  showActions = true,
  isEditingMode = false,
  editingSlot = null,
  onTemplateChange,
  templateToNavigate,
  onNavigationComplete,
  initialIndex = 0
}: TemplateGridProps) {
  
  // Cover Flow state
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  
  // Container-aware sizing state
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  
  // Sync status state for all templates - Removed as redundant with global sync status
  // const [syncStatuses, setSyncStatuses] = useState<Map<string, SyncStatus>>(new Map());
  
  // Dynamic sizing calculation based on actual available space
  const calculateOptimalSize = () => {
    const availableWidth = containerSize.width || windowSize.width || 1024;
    const availableHeight = containerSize.height || windowSize.height || 768;
    
    // Calculate optimal template width based on available space
    // Leave margins for navigation arrows and padding
    const horizontalMargin = 120; // Space for side arrows and padding
    const verticalMargin = 80;   // Space for buttons and padding (reduced for more template space)
    
    const maxWidth = availableWidth - horizontalMargin;
    const maxHeight = availableHeight - verticalMargin;
    
    // Template aspect ratio for 4R (typical photo template)
    const templateAspectRatio = 2/3; // width/height ratio
    
    // Calculate width-constrained and height-constrained sizes
    const widthConstrainedWidth = Math.min(maxWidth, 600); // Cap at reasonable maximum
    const widthConstrainedHeight = widthConstrainedWidth / templateAspectRatio;
    
    const heightConstrainedHeight = Math.min(maxHeight, 800); // Cap at reasonable maximum  
    const heightConstrainedWidth = heightConstrainedHeight * templateAspectRatio;
    
    // Use the smaller of the two to ensure template fits in both dimensions
    const optimalWidth = Math.min(widthConstrainedWidth, heightConstrainedWidth);
    const optimalSpacing = Math.max(100, optimalWidth * 0.4); // Spacing proportional to template size
    
    return {
      width: Math.max(250, Math.min(optimalWidth, 600)), // Min 250px, max 600px
      spacing: optimalSpacing
    };
  };

  // State for animation
  const [animatingTemplateId, setAnimatingTemplateId] = useState<string | null>(null);

  // Group slots by template
  const templateGroups = Object.values(
    templateSlots.reduce((acc, slot) => {
      if (!acc[slot.templateId]) {
        acc[slot.templateId] = {
          templateId: slot.templateId,
          templateName: slot.templateName,
          slots: [],
        };
      }
      acc[slot.templateId].slots.push(slot);
      return acc;
    }, {} as Record<string, { templateId: string; templateName: string; slots: TemplateSlot[] }>)
  );

  // Cover Flow navigation
  const navigateToTemplate = (index: number) => {
    if (isEditingMode) {
      if (process.env.NODE_ENV === 'development') console.log('🚫 Template navigation blocked - editing in progress');
      return;
    }
    if (index >= 0 && index < templateGroups.length) {
      const oldIndex = currentIndex;
      setCurrentIndex(index);
      
      // Notify parent of template change
      if (onTemplateChange && index !== oldIndex) {
        const newTemplate = templateGroups[index];
        if (process.env.NODE_ENV === 'development') console.log('📱 Template navigation - notifying parent:', {
          fromIndex: oldIndex,
          toIndex: index,
          templateId: newTemplate.templateId,
          templateName: newTemplate.templateName
        });
        onTemplateChange(index, newTemplate.templateId);
      }
    }
  };

  // Window resize listener for responsive sizing
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // Set initial size
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Container ResizeObserver for precise container measurements
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width: Math.round(width), height: Math.round(height) });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Auto-navigate to newly added template
  useEffect(() => {
    if (templateToNavigate && layout === 'coverflow') {
      // Find the index of the template to navigate to
      const targetIndex = templateGroups.findIndex(group => group.templateId === templateToNavigate);
      
      if (targetIndex !== -1 && targetIndex !== currentIndex) {
        if (process.env.NODE_ENV === 'development') console.log('🚀 Auto-navigating to newly added template:', {
          templateId: templateToNavigate,
          targetIndex,
          currentIndex
        });
        
        // Start animation for the new template
        setAnimatingTemplateId(templateToNavigate);
        
        // Navigate to the template with a slight delay for visual effect
        const navigationTimer = setTimeout(() => {
          navigateToTemplate(targetIndex);
          
          // Clear animation after navigation
          const animationTimer = setTimeout(() => {
            setAnimatingTemplateId(null);
          }, 1000);
          
          // Cleanup animation timer
          return () => clearTimeout(animationTimer);
        }, 100);
        
        // Notify parent that navigation is complete
        if (onNavigationComplete) {
          const completeTimer = setTimeout(() => {
            onNavigationComplete();
          }, 600);
          
          // Cleanup complete timer
          return () => clearTimeout(completeTimer);
        }
        
        // Cleanup navigation timer
        return () => clearTimeout(navigationTimer);
      } else if (targetIndex !== -1 && onNavigationComplete) {
        // Already at the target, just notify completion
        onNavigationComplete();
      }
    }
  }, [templateToNavigate, layout, onNavigationComplete]); // Removed templateGroups and currentIndex to prevent loops

  // Keyboard navigation for Cover Flow
  useEffect(() => {
    if (layout !== 'coverflow') return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateToTemplate(currentIndex - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateToTemplate(currentIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [layout, currentIndex, templateGroups.length]);

  // Update sync statuses for all templates periodically - Removed as redundant with global sync status
  /* useEffect(() => {
    const updateSyncStatuses = () => {
      setSyncStatuses(prevStatuses => {
        const newStatuses = new Map<string, SyncStatus>();
        let hasChanges = false;
        
        // Get unique template IDs
        const uniqueTemplateIds = [...new Set(templateSlots.map(slot => slot.templateId))];
        
        uniqueTemplateIds.forEach(templateId => {
          const currentStatus = templateSyncService.getTemplateSyncStatus(templateId);
          const previousStatus = prevStatuses.get(templateId);
          
          newStatuses.set(templateId, currentStatus);
          
          if (previousStatus !== currentStatus) {
            hasChanges = true;
          }
        });
        
        // Only update state if there are actual changes
        return hasChanges ? newStatuses : prevStatuses;
      });
    };
    
    // Initial update
    updateSyncStatuses();
    
    // Update every 500ms (faster than the 1-second interval to catch status changes quickly)
    const interval = setInterval(updateSyncStatuses, 500);
    
    return () => clearInterval(interval);
  }, [templateSlots]); */

  const containerClasses = layout === 'horizontal' 
    ? "flex space-x-2 sm:space-x-3 overflow-x-auto h-full pb-2" 
    : layout === 'main'
    ? "grid grid-cols-1 md:grid-cols-2 gap-6 p-4"
    : layout === 'coverflow'
    ? "relative w-full h-full flex items-center justify-center overflow-hidden"
    : "space-y-2";

  const itemClasses = layout === 'horizontal' 
    ? "flex-shrink-0 relative pt-4" 
    : layout === 'main'
    ? "relative bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow"
    : layout === 'coverflow'
    ? "absolute transition-all duration-500 ease-in-out cursor-pointer"
    : "relative";

  const itemStyle = layout === 'horizontal' 
    ? { width: '180px' } 
    : {};

  const visualHeight = layout === 'horizontal' 
    ? undefined 
    : undefined; // Let aspectRatio CSS property control dimensions instead of fixed heights

  // Cover Flow item positioning and styling
  const getCoverFlowStyle = (index: number) => {
    if (layout !== 'coverflow') return {};
    
    const offset = index - currentIndex;
    const absOffset = Math.abs(offset);
    
    // Use dynamic container-aware sizing instead of hardcoded breakpoints
    const { width: baseWidth, spacing } = calculateOptimalSize();
    
    // Determine if this is a mobile-like screen for rotation/scale adjustments
    const isMobileSize = baseWidth <= 400;
    
    // Center item
    if (offset === 0) {
      return {
        transform: 'translateX(0px) scale(1) rotateY(0deg)',
        zIndex: 10,
        opacity: 1,
        width: `${baseWidth}px`,
      };
    }
    
    // Side items
    const translateX = offset * spacing; // Spacing between items
    const scale = Math.max(isMobileSize ? 0.7 : 0.6, 1 - absOffset * 0.2);
    const rotateY = offset > 0 ? (isMobileSize ? 15 : 25) : (isMobileSize ? -15 : -25);
    const opacity = Math.max(0.3, 1 - absOffset * 0.3);
    const zIndex = 10 - absOffset;
    
    return {
      transform: `translateX(${translateX}px) scale(${scale}) rotateY(${rotateY}deg)`,
      zIndex,
      opacity,
      width: `${baseWidth}px`,
    };
  };

  // Use swipe gesture hook for coverflow navigation
  const { handlers: swipeHandlers } = useSwipeGesture({
    onSwipeLeft: () => {
      if (layout === 'coverflow') {
        navigateToTemplate(currentIndex + 1);
      }
    },
    onSwipeRight: () => {
      if (layout === 'coverflow') {
        navigateToTemplate(currentIndex - 1);
      }
    },
    minSwipeDistance: 50,
    swipeThreshold: 0.25, // 25% of container width
  });

  return (
    <div 
      ref={containerRef}
      className={containerClasses} 
      style={{ 
        touchAction: layout === 'horizontal' ? 'pan-x' : layout === 'coverflow' ? 'pan-x' : 'auto',
        perspective: layout === 'coverflow' ? '1000px' : 'none'
      }}
      {...(layout === 'coverflow' ? swipeHandlers : {})}
    >
      {templateGroups.map(({ templateId, templateName, slots }, index) => {
        // Check if this template contains the currently editing slot
        const isCurrentEditingTemplate = editingSlot && slots.some(slot => slot.id === editingSlot.id);
        const shouldBlock = isEditingMode && !isCurrentEditingTemplate;
        
        const isAnimating = animatingTemplateId === templateId;
        
        return (
          <div 
            key={`template-container-${templateId}`} 
            className={`${itemClasses} ${shouldBlock ? 'pointer-events-none brightness-75' : ''} ${isAnimating ? 'animate-template-pop' : ''}`}
            style={{
              ...itemStyle,
              ...getCoverFlowStyle(index)
            }}
            onClick={() => layout === 'coverflow' ? navigateToTemplate(index) : undefined}
          >
          {/* Title and action buttons at same height */}
          <div className="flex justify-between items-center mb-2 px-3 sm:px-4 md:px-6">
            <h3 className={`font-semibold leading-tight truncate flex-1 ${
              layout === 'horizontal' ? 'text-xs' : 'text-sm'
            }`}>
              {templateName}
            </h3>
            
            {/* Sync status indicator - Removed as redundant with global sync status */}
            {/* {slots.every(s => s.photoId) && (
              <SyncStatusIndicator 
                status={syncStatuses.get(templateId) || null} 
                className="mr-2"
              />
            )} */}
            
            {showActions && (
              <div className="flex items-center space-x-1 sm:space-x-2 ml-2">
                {/* Download button hidden per user request */}
                {/* {onDownloadTemplate && (
                  <button
                    onClick={() => {
                      if (isEditingMode) {
                        if (process.env.NODE_ENV === 'development') console.log('🚫 Download blocked - editing in progress');
                        return;
                      }
                      onDownloadTemplate({ templateId, templateName, slots });
                    }}
                    title="Download Template"
                    className={`bg-gray-500 text-white rounded-full p-1 sm:p-1.5 shadow-sm hover:bg-gray-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 ${
                      isEditingMode ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`${layout === 'horizontal' ? 'h-3 w-3' : 'h-4 w-4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                )} */}
                
                {/* Change Template button for all templates */}
                {onSwapTemplate && (
                  <button
                    onClick={() => {
                      if (isEditingMode) {
                        if (process.env.NODE_ENV === 'development') console.log('🚫 Template swap blocked - editing in progress');
                        return;
                      }
                      onSwapTemplate({ templateId, templateName, slots }, index);
                    }}
                    className={`bg-gray-500 text-white px-2 sm:px-3 py-1 rounded-md text-xs font-medium hover:bg-gray-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 shadow-sm ${
                      isEditingMode ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    Change Template
                  </button>
                )}
                
                {/* Delete button for additional templates only */}
                {onDeleteTemplate && slots[0]?.isAdditional && (
                  <button
                    onClick={() => {
                      if (isEditingMode) {
                        if (process.env.NODE_ENV === 'development') console.log('🚫 Template delete blocked - editing in progress');
                        return;
                      }
                      onDeleteTemplate(templateId);
                    }}
                    title="Remove Print"
                    className={`text-gray-400 hover:text-gray-600 rounded-full p-1 sm:p-1.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 ${
                      isEditingMode ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`${layout === 'horizontal' ? 'h-4 w-4' : 'h-5 w-5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
          
          <div className="w-full overflow-hidden border border-gray-200" style={visualHeight}>
            <TemplateVisual
              key={`template-visual-${templateId}`}
              template={{ id: slots[0]?.templateType || templateId.split('_')[0], name: templateName, slots: slots.length }}
              slots={slots}
              onSlotClick={onSlotClick}
              photos={photos}
              selectedSlot={selectedSlot}
              isActiveTemplate={layout === 'coverflow' ? index === currentIndex : true}
            />
          </div>
        </div>
        );
      })}
      
      {/* Side Navigation Arrows */}
      {layout === 'coverflow' && (
        <>
          {/* Left Arrow - Previous Template */}
          {currentIndex > 0 && (
            <button
              onClick={() => {
                if (isEditingMode) {
                  if (process.env.NODE_ENV === 'development') console.log('🚫 Previous template blocked - editing in progress');
                  return;
                }
                navigateToTemplate(currentIndex - 1);
              }}
              className={`absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-20 hover:bg-opacity-40 text-white rounded-full p-3 transition-all duration-200 z-30 ${
                isEditingMode ? 'opacity-30 cursor-not-allowed' : ''
              }`}
              title="Previous template"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          
          {/* Right Arrow - Next Template */}
          {currentIndex < templateGroups.length - 1 && (
            <button
              onClick={() => {
                if (isEditingMode) {
                  if (process.env.NODE_ENV === 'development') console.log('🚫 Next template blocked - editing in progress');
                  return;
                }
                navigateToTemplate(currentIndex + 1);
              }}
              className={`absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-20 hover:bg-opacity-40 text-white rounded-full p-3 transition-all duration-200 z-30 ${
                isEditingMode ? 'opacity-30 cursor-not-allowed' : ''
              }`}
              title="Next template"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </>
      )}
    </div>
  );
}

// Custom comparison function for React.memo
const arePropsEqual = (prevProps: TemplateGridProps, nextProps: TemplateGridProps): boolean => {
  // Compare essential props that should trigger re-renders
  if (
    prevProps.layout !== nextProps.layout ||
    prevProps.showActions !== nextProps.showActions ||
    prevProps.isEditingMode !== nextProps.isEditingMode ||
    prevProps.templateToNavigate !== nextProps.templateToNavigate
  ) {
    return false; // Props changed, re-render needed
  }

  // Compare selected slot
  if (prevProps.selectedSlot?.id !== nextProps.selectedSlot?.id) {
    return false; // Selection changed, re-render needed
  }

  // Compare editing slot
  if (prevProps.editingSlot?.id !== nextProps.editingSlot?.id) {
    return false; // Editing state changed, re-render needed
  }

  // Compare template slots length and essential properties
  if (prevProps.templateSlots.length !== nextProps.templateSlots.length) {
    return false; // Slots array length changed, re-render needed
  }

  // Compare slots by checking their essential properties
  for (let i = 0; i < prevProps.templateSlots.length; i++) {
    const prevSlot = prevProps.templateSlots[i];
    const nextSlot = nextProps.templateSlots[i];

    if (
      prevSlot.id !== nextSlot.id ||
      prevSlot.photoId !== nextSlot.photoId ||
      prevSlot.templateId !== nextSlot.templateId
    ) {
      return false; // Slot changed, re-render needed
    }
  }

  // Compare photos array length and essential properties
  if (prevProps.photos.length !== nextProps.photos.length) {
    return false; // Photos array length changed, re-render needed
  }

  // For photos, only compare IDs and URLs as they're most relevant for display
  for (let i = 0; i < prevProps.photos.length; i++) {
    const prevPhoto = prevProps.photos[i];
    const nextPhoto = nextProps.photos[i];

    if (prevPhoto.id !== nextPhoto.id || prevPhoto.url !== nextPhoto.url) {
      return false; // Photo changed, re-render needed
    }
  }

  // All other props are functions or non-critical, skip deep comparison
  return true; // Props are equivalent, skip re-render
};

// Export memoized component to prevent unnecessary re-renders
export default React.memo(TemplateGrid, arePropsEqual);