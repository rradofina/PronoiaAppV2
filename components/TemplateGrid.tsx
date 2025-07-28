import React, { useState, useEffect } from 'react';
import { TemplateSlot, Photo } from '../types';

interface TemplateGridProps {
  templateSlots: TemplateSlot[];
  photos: Photo[];
  selectedSlot: TemplateSlot | null;
  onSlotClick: (slot: TemplateSlot) => void;
  onSwapTemplate?: (template: { templateId: string; templateName: string; slots: TemplateSlot[] }) => void;
  onDeleteTemplate?: (templateId: string) => void;
  onDownloadTemplate?: (template: { templateId: string; templateName: string; slots: TemplateSlot[] }) => void;
  TemplateVisual: React.ComponentType<any>;
  layout?: 'horizontal' | 'vertical' | 'main' | 'coverflow';
  showActions?: boolean;
}

export default function TemplateGrid({
  templateSlots,
  photos,
  selectedSlot,
  onSlotClick,
  onSwapTemplate,
  onDeleteTemplate,
  onDownloadTemplate,
  TemplateVisual,
  layout = 'horizontal',
  showActions = true
}: TemplateGridProps) {
  
  // Cover Flow state
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Touch swipe state for coverflow navigation
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  
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
    if (index >= 0 && index < templateGroups.length) {
      setCurrentIndex(index);
    }
  };

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
    : layout === 'main'
    ? { height: '500px' }
    : layout === 'coverflow'
    ? { height: '600px' }  // Increased from 400px to 600px for better space utilization
    : { height: '400px' };

  // Cover Flow item positioning and styling
  const getCoverFlowStyle = (index: number) => {
    if (layout !== 'coverflow') return {};
    
    const offset = index - currentIndex;
    const absOffset = Math.abs(offset);
    
    // Responsive sizing - improved for better template display
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const baseWidth = isMobile ? 300 : 450;  // Increased from 400 to 450 for desktop
    const spacing = isMobile ? 140 : 200;    // Increased spacing from 180 to 200
    
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
    const scale = Math.max(isMobile ? 0.7 : 0.6, 1 - absOffset * 0.2);
    const rotateY = offset > 0 ? (isMobile ? 15 : 25) : (isMobile ? -15 : -25);
    const opacity = Math.max(0.3, 1 - absOffset * 0.3);
    const zIndex = 10 - absOffset;
    
    return {
      transform: `translateX(${translateX}px) scale(${scale}) rotateY(${rotateY}deg)`,
      zIndex,
      opacity,
      width: `${baseWidth}px`,
    };
  };

  // Touch swipe handlers for coverflow navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    if (layout !== 'coverflow') return;
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchEnd(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (layout !== 'coverflow') return;
    const touch = e.touches[0];
    setTouchEnd({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = () => {
    if (layout !== 'coverflow' || !touchStart || !touchEnd) return;
    
    const deltaX = touchStart.x - touchEnd.x;
    const deltaY = touchStart.y - touchEnd.y;
    const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
    const minSwipeDistance = 50;

    if (isHorizontalSwipe && Math.abs(deltaX) > minSwipeDistance) {
      if (deltaX > 0) {
        // Swiped left - go to next template
        navigateToTemplate(currentIndex + 1);
      } else {
        // Swiped right - go to previous template
        navigateToTemplate(currentIndex - 1);
      }
    }
    
    setTouchStart(null);
    setTouchEnd(null);
  };

  return (
    <div 
      className={containerClasses} 
      style={{ 
        touchAction: layout === 'horizontal' ? 'pan-x' : layout === 'coverflow' ? 'pan-x' : 'auto',
        perspective: layout === 'coverflow' ? '1000px' : 'none'
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {templateGroups.map(({ templateId, templateName, slots }, index) => (
        <div 
          key={templateId} 
          className={itemClasses} 
          style={{
            ...itemStyle,
            ...getCoverFlowStyle(index)
          }}
          onClick={() => layout === 'coverflow' ? navigateToTemplate(index) : undefined}
        >
          {/* Title and action buttons at same height */}
          <div className="flex justify-between items-center mb-2 px-1">
            <h3 className={`font-semibold leading-tight truncate flex-1 ${
              layout === 'horizontal' ? 'text-xs' : 'text-sm'
            }`}>
              {templateName}
            </h3>
            
            {showActions && (
              <div className="flex items-center space-x-1 ml-2">
                {/* Download button for all templates */}
                {onDownloadTemplate && (
                  <button
                    onClick={() => onDownloadTemplate({ templateId, templateName, slots })}
                    title="Download Template"
                    className="bg-gray-500 text-white rounded-full p-1 shadow-sm hover:bg-gray-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`${layout === 'horizontal' ? 'h-3 w-3' : 'h-4 w-4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                )}
                
                {/* Change Template button for all templates */}
                {onSwapTemplate && (
                  <button
                    onClick={() => onSwapTemplate({ templateId, templateName, slots })}
                    className="bg-gray-500 text-white px-2 py-1 rounded-md text-xs font-medium hover:bg-gray-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 shadow-sm"
                  >
                    Change Template
                  </button>
                )}
                
                {/* Delete button for additional templates only */}
                {onDeleteTemplate && templateName.includes('(Additional)') && (
                  <button
                    onClick={() => onDeleteTemplate(templateId)}
                    title="Delete Print"
                    className="bg-red-600 text-white rounded-full p-1 shadow-sm hover:bg-red-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`${layout === 'horizontal' ? 'h-3 w-3' : 'h-4 w-4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
          
          <div className="w-full rounded-lg overflow-hidden border border-gray-200" style={visualHeight}>
            <TemplateVisual
              key={`template-visual-${templateId}-${slots[0]?.templateType || templateId.split('_')[0]}`}
              template={{ id: slots[0]?.templateType || templateId.split('_')[0], name: templateName, slots: slots.length }}
              slots={slots}
              onSlotClick={onSlotClick}
              photos={photos}
              selectedSlot={selectedSlot}
            />
          </div>
        </div>
      ))}
      
      {/* Cover Flow Navigation Controls */}
      {layout === 'coverflow' && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-4 z-20">
          <button
            onClick={() => navigateToTemplate(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="bg-white bg-opacity-80 hover:bg-opacity-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-full p-2 shadow-lg transition-all duration-200"
            title="Previous template"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <div className="flex items-center space-x-1">
            {templateGroups.map((_, index) => (
              <button
                key={index}
                onClick={() => navigateToTemplate(index)}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  index === currentIndex 
                    ? 'bg-blue-600 w-6' 
                    : 'bg-white bg-opacity-60 hover:bg-opacity-80'
                }`}
                title={`Go to template ${index + 1}`}
              />
            ))}
          </div>
          
          <button
            onClick={() => navigateToTemplate(currentIndex + 1)}
            disabled={currentIndex === templateGroups.length - 1}
            className="bg-white bg-opacity-80 hover:bg-opacity-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-full p-2 shadow-lg transition-all duration-200"
            title="Next template"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}