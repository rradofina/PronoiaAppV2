import React, { useState } from 'react';
import { ManualTemplate, Photo } from '../types';
import { AnimatedTemplateItem } from './animations/AnimatedTemplateReveal';
import PngTemplateVisual from './PngTemplateVisual';
import TemplateSelectionModal from './TemplateSelectionModal';
import { getSamplePhotosForTemplate } from '../utils/samplePhotoUtils';
import { createPhotoTransform, PhotoTransform } from '../types';

// Create smart preview transform that optimizes photo for hole aspect ratio with gap-free auto-fit
function createPreviewTransform(holeAspectRatio: number, photoAspectRatio: number | null = null): PhotoTransform {
  // For preview mode, we want photos to completely fill holes with no gaps (object-cover behavior)
  // Calculate the scale needed to ensure no empty space in holes
  let previewScale = 1.0; // Start with base scale
  
  // If we know the photo aspect ratio, calculate exact scale for gap-free fit
  if (photoAspectRatio) {
    if (photoAspectRatio > holeAspectRatio) {
      // Photo is wider than hole - need to scale by height to fill completely
      // This ensures height fills hole completely, width may overflow (no gaps)
      previewScale = 1.0; // PhotoRenderer with object-cover handles this automatically
    } else {
      // Photo is taller than hole - need to scale by width to fill completely  
      // This ensures width fills hole completely, height may overflow (no gaps)
      previewScale = 1.0; // PhotoRenderer with object-cover handles this automatically
    }
  } else {
    // No photo aspect ratio available, use safe auto-fit scale
    previewScale = 1.0; // Let object-cover behavior handle gap elimination
  }
  
  // Center the photo by default for preview - object-cover will handle proper scaling
  return createPhotoTransform(previewScale, 0.5, 0.5);
}

interface PackageTemplatePreviewProps {
  templates: ManualTemplate[];
  packageName: string;
  onContinue: () => void;
  onChangePackage: () => void;
  onTemplateSelect?: (template: ManualTemplate) => void;
  availablePhotos?: Photo[]; // Photos from client folder for samples
  loading?: boolean;
}

export default function PackageTemplatePreview({
  templates,
  packageName,
  onContinue,
  onChangePackage,
  onTemplateSelect,
  availablePhotos = [],
  loading = false
}: PackageTemplatePreviewProps) {
  
  // Modal state for template selection
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateToChange, setTemplateToChange] = useState<ManualTemplate | null>(null);
  const [currentTemplates, setCurrentTemplates] = useState<ManualTemplate[]>(templates);
  const [forceRenderKey, setForceRenderKey] = useState(0);
  
  // Update currentTemplates when templates prop changes (but preserve user replacements)
  React.useEffect(() => {
    console.log('📥 TEMPLATES PROP CHANGED:', {
      newTemplatesCount: templates.length,
      currentTemplatesCount: currentTemplates.length,
      newTemplateIds: templates.map(t => t.id),
      currentTemplateIds: currentTemplates.map(t => t.id),
      templatesChanged: JSON.stringify(templates.map(t => t.id)) !== JSON.stringify(currentTemplates.map(t => t.id))
    });
    
    // ONLY update on initial load - never override user template replacements
    if (currentTemplates.length === 0) {
      console.log('🔄 INITIALIZING TEMPLATES - First load only');
      setCurrentTemplates(templates);
    } else {
      console.log('⚠️ PRESERVING USER TEMPLATE REPLACEMENTS - Not overriding local changes');
    }
  }, [templates]);

  // Modal handlers
  const handleChangeTemplate = (template: ManualTemplate) => {
    setTemplateToChange(template);
    setShowTemplateModal(true);
  };

  const handleTemplateReplace = (newTemplate: ManualTemplate) => {
    if (!templateToChange) return;
    
    console.log('🔄 TEMPLATE REPLACEMENT DEBUG:', {
      beforeCount: currentTemplates.length,
      templateToChangeId: templateToChange.id,
      templateToChangeName: templateToChange.name,
      newTemplateId: newTemplate.id,
      newTemplateName: newTemplate.name,
      currentTemplateIds: currentTemplates.map(t => t.id),
      currentTemplateNames: currentTemplates.map(t => t.name)
    });
    
    // Replace the template in the current templates array
    const updatedTemplates = currentTemplates.map((t, index) => {
      const isMatch = t.id === templateToChange.id;
      console.log(`🔍 CHECKING TEMPLATE ${index + 1}:`, {
        templateId: t.id,
        templateToChangeId: templateToChange.id,
        isMatch,
        templateName: t.name,
        willReplace: isMatch ? `YES with ${newTemplate.name}` : 'NO'
      });
      return isMatch ? newTemplate : t;
    });
    
    // Validate that replacement actually occurred
    const replacementWorked = updatedTemplates.some(t => t.id === newTemplate.id);
    const oldTemplateRemoved = !updatedTemplates.some(t => t.id === templateToChange.id);
    const countStayedSame = updatedTemplates.length === currentTemplates.length;
    
    console.log('🔄 AFTER TEMPLATE REPLACEMENT:', {
      afterCount: updatedTemplates.length,
      beforeCount: currentTemplates.length,
      countStayedSame,
      updatedTemplateIds: updatedTemplates.map(t => t.id),
      updatedTemplateNames: updatedTemplates.map(t => t.name),
      replacementWorked,
      oldTemplateRemoved,
      validReplacement: replacementWorked && oldTemplateRemoved && countStayedSame
    });
    
    // Alert if replacement failed
    if (!replacementWorked || !oldTemplateRemoved || !countStayedSame) {
      console.error('❌ TEMPLATE REPLACEMENT FAILED:', {
        replacementWorked,
        oldTemplateRemoved,
        countStayedSame,
        expected: 'All should be true'
      });
    }
    
    setCurrentTemplates(updatedTemplates);
    
    // Force React to re-render by updating render key
    setForceRenderKey(prev => prev + 1);
    console.log('🔄 FORCING REACT RE-RENDER with new render key:', forceRenderKey + 1);
    
    setShowTemplateModal(false);
    setTemplateToChange(null);
    
    console.log('✅ Template replaced:', {
      oldTemplate: templateToChange.name,
      newTemplate: newTemplate.name,
      printSize: newTemplate.print_size
    });
  };

  const handleCloseModal = () => {
    setShowTemplateModal(false);
    setTemplateToChange(null);
  };

  // Count total holes across all templates for global photo assignment
  const totalHoles = currentTemplates.reduce((total, template) => {
    return total + (template.holes_data?.length || 0);
  }, 0);
  
  // Extract photo filenames for assignment
  const photoFilenames = availablePhotos.map(photo => photo.name || `Photo ${photo.id}`);
  
  // Create global photo assignment strategy
  const createGlobalPhotoAssignment = (globalHoleIndex: number): string => {
    if (photoFilenames.length === 0) return `Sample-${globalHoleIndex + 1}`;
    
    // Loop filenames if more holes than photos
    const photoIndex = globalHoleIndex % photoFilenames.length;
    return photoFilenames[photoIndex];
  };
  
  console.log(`📊 GLOBAL PHOTO ASSIGNMENT STRATEGY:`, {
    totalTemplates: currentTemplates.length,
    totalHoles,
    availablePhotos: photoFilenames.length,
    photoFilenames: photoFilenames.slice(0, 5), // Show first 5 filenames
    strategy: photoFilenames.length >= totalHoles 
      ? 'Unique assignment (enough photos)' 
      : `Looped assignment (${photoFilenames.length} photos for ${totalHoles} holes)`
  });
  
  if (loading) {
    return (
      <div className="mt-6 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading templates...</span>
        </div>
      </div>
    );
  }

  if (currentTemplates.length === 0) {
    return (
      <div className="mt-6 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="text-center py-8">
          <div className="text-gray-500 mb-4">No templates found in this package</div>
          <button
            onClick={onChangePackage}
            className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600 transition-colors"
          >
            Choose Different Package
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Templates in "{packageName}"
        </h3>
        <div className="text-sm text-gray-600">
          {currentTemplates.length} template{currentTemplates.length > 1 ? 's' : ''} available
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {currentTemplates.map((template, index) => {
          console.log(`🎨 RENDERING TEMPLATE ${index + 1}:`, {
            templateId: template.id,
            templateName: template.name,
            templateType: template.template_type,
            renderTimestamp: new Date().toISOString()
          });
          
          // Calculate global hole index offset for this template
          const globalHoleOffset = currentTemplates.slice(0, index).reduce((offset, prevTemplate) => {
            return offset + (prevTemplate.holes_data?.length || 0);
          }, 0);
          console.log(`🔍 TEMPLATE PREVIEW DEBUG - Processing template ${index + 1}:`, {
            templateId: template.id,
            templateName: template.name,
            templateType: template.template_type,
            driveFileId: template.drive_file_id,
            holesCount: template.holes_data?.length || 0,
            holes: template.holes_data?.slice(0, 3), // Show first 3 holes for debugging
            availablePhotosCount: availablePhotos.length
          });

          // Generate sample photos for this template
          const samplePhotos = getSamplePhotosForTemplate(
            availablePhotos,
            template.holes_data?.length || 0,
            template.id.toString()
          );

          console.log(`📸 PHOTO ASSIGNMENT DEBUG - Template ${template.id}:`, {
            requestedPhotos: template.holes_data?.length || 0,
            generatedPhotos: samplePhotos.length,
            photoIds: samplePhotos.map(p => p.id),
            photoUrls: samplePhotos.map(p => p.url?.substring(0, 80) + '...')
          });

          // Create mock template slots for sample photos with smart preview transforms
          const sampleSlots = samplePhotos.map((photo, slotIndex) => {
            // Calculate hole aspect ratio for this slot
            const hole = template.holes_data?.[slotIndex];
            const holeAspectRatio = hole ? hole.width / hole.height : 1.0;
            
            // Estimate photo aspect ratio (assume typical photo ratios if not available)
            // Most photos are either 4:3, 3:2, or 16:9 - we'll use 3:2 as default
            const photoAspectRatio = 3/2; // Can be refined with actual photo dimensions later
            
            // Create smart preview transform for this hole
            const previewTransform = createPreviewTransform(holeAspectRatio, photoAspectRatio);
            
            console.log(`🎯 SMART PREVIEW TRANSFORM - Slot ${slotIndex + 1}:`, {
              holeSize: hole ? `${Math.round(hole.width)}×${Math.round(hole.height)}` : 'unknown',
              holeAspectRatio: holeAspectRatio.toFixed(2),
              photoAspectRatio: photoAspectRatio.toFixed(2),
              previewScale: previewTransform.photoScale,
              strategy: holeAspectRatio > 1.3 ? 'wide hole' : holeAspectRatio < 0.8 ? 'tall hole' : 'square hole'
            });
            
            return {
              id: `sample-slot-${template.id}-${slotIndex}`,
              templateId: template.id.toString(),
              templateName: template.name,
              templateType: template.template_type,
              slotIndex,
              photoId: photo.id,
              transform: previewTransform
            };
          });

          // Create photo filename assignments for this template's holes
          const holePhotoAssignments = (template.holes_data || []).map((hole, holeIndex) => {
            const globalHoleIndex = globalHoleOffset + holeIndex;
            const assignedFilename = createGlobalPhotoAssignment(globalHoleIndex);
            
            console.log(`📸 HOLE ASSIGNMENT - Template ${template.id}, Hole ${holeIndex + 1}:`, {
              globalHoleIndex,
              localHoleIndex: holeIndex,
              assignedFilename,
              holeSize: `${Math.round(hole.width)}×${Math.round(hole.height)}`
            });
            
            return assignedFilename;
          });

          console.log(`🎯 SLOT MAPPING DEBUG - Template ${template.id}:`, {
            slotsCreated: sampleSlots.length,
            slotIds: sampleSlots.map(s => s.id),
            slotPhotoIds: sampleSlots.map(s => s.photoId),
            holePhotoAssignments
          });

          return (
            <AnimatedTemplateItem key={`${template.id}-${forceRenderKey}`} index={index}>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:shadow-md transition-shadow">
                {/* Template Header with Name and Change Button */}
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 text-sm truncate">
                      {template.name}
                    </h4>
                    <div className="text-xs text-gray-500 mt-1">
                      {template.holes_data?.length || 0} photo slot{(template.holes_data?.length || 0) !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => handleChangeTemplate(template)}
                    className="ml-2 bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 whitespace-nowrap"
                  >
                    Change Template
                  </button>
                </div>

                {/* Template Visual Preview with Sample Photos */}
                <div 
                  className="bg-white rounded border border-gray-200 overflow-hidden mb-1 flex items-center justify-center"
                  style={{
                    aspectRatio: `${template.holes_data && template.holes_data.length > 0 ? '1200/1800' : '2/3'}`,
                    minHeight: '250px',
                    maxHeight: '500px'
                  }}
                >
                  {template.drive_file_id ? (
                    <PngTemplateVisual
                      pngTemplate={{
                        id: template.id.toString(),
                        name: template.name,
                        templateType: template.template_type,
                        driveFileId: template.drive_file_id,
                        holes: template.holes_data || [],
                        dimensions: template.dimensions || {
                          width: 1200,
                          height: 1800
                        },
                        printSize: template.print_size,
                        pngUrl: (() => {
                          // Robust PNG URL construction (matches PngTemplateVisual logic)
                          const fileId = template.drive_file_id?.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1] || template.drive_file_id;
                          const cleanFileId = fileId?.replace(/[^a-zA-Z0-9-_]/g, ''); // Clean any extra characters
                          const pngUrl = cleanFileId ? `https://lh3.googleusercontent.com/d/${cleanFileId}` : '';
                          
                          console.log(`🖼️ PNG TEMPLATE URL DEBUG - Template ${template.id}:`, {
                            originalDriveFileId: template.drive_file_id,
                            extractedFileId: fileId,
                            cleanFileId,
                            finalPngUrl: pngUrl
                          });
                          
                          return pngUrl;
                        })(),
                        hasInternalBranding: false,
                        lastUpdated: new Date(),
                        createdAt: new Date()
                      }}
                      templateSlots={sampleSlots} // Re-enable sample slots
                      onSlotClick={() => {}} // No interaction in preview
                      photos={samplePhotos} // Re-enable sample photos
                      selectedSlot={null}
                      isEditingMode={false}
                      isActiveTemplate={false} // Non-interactive preview
                      debugHoles={false} // Show actual photos with auto-fit
                      holePhotoAssignments={holePhotoAssignments} // Pass photo filename assignments
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                      Preview unavailable
                    </div>
                  )}
                </div>

              </div>
            </AnimatedTemplateItem>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 border-t border-gray-200">
        <button
          onClick={onContinue}
          className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-sm hover:shadow-md"
        >
          Continue with "{packageName}"
        </button>
        <button
          onClick={onChangePackage}
          className="flex-1 sm:flex-none bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 border border-gray-300"
        >
          Choose Different Package
        </button>
      </div>

      {/* Template Selection Modal */}
      {templateToChange && (
        <TemplateSelectionModal
          isOpen={showTemplateModal}
          onClose={handleCloseModal}
          currentTemplate={templateToChange}
          availablePhotos={availablePhotos}
          onTemplateSelect={handleTemplateReplace}
        />
      )}
    </div>
  );
}