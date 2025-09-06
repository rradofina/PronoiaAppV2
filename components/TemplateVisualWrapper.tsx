import React, { useState, useEffect } from 'react';
import PngTemplateVisual from './PngTemplateVisual';
import { manualTemplateService } from '../services/manualTemplateService';

// Extracted from PhotoSelectionScreen to prevent recreation on every parent render
// This was causing snap-back and flashing issues due to component unmount/remount cycles
const TemplateVisualWrapper = ({ 
  template, 
  slots, 
  onSlotClick, 
  photos, 
  selectedSlot, 
  inlineEditingSlot, 
  inlineEditingPhoto, 
  onInlineApply, 
  onInlineCancel, 
  skipStateGuard, 
  isActiveTemplate = true, 
  slotShowingRemoveConfirmation, 
  onConfirmRemove, 
  onCancelRemove, 
  onDropPhoto, 
  isDraggingPhoto, 
  previewSlotId, 
  previewPhotoId, 
  onSetPreviewSlot 
}: any) => {
  // Get templates from both window cache AND database to ensure consistency with swap modal
  const windowTemplates = (window as any).pngTemplates || [];
  const [databaseTemplates, setDatabaseTemplates] = useState<any[]>([]);
  
  // Load all templates from database for consistent template matching
  useEffect(() => {
    const loadAllTemplates = async () => {
      try {
        const allDbTemplates = await manualTemplateService.getActiveTemplates();
        const convertedTemplates = allDbTemplates.map(template => ({
          ...template,
          holes: template.holes_data,
          driveFileId: template.drive_file_id
        }));
        setDatabaseTemplates(convertedTemplates);
        console.log('📋 Loaded all templates from database for consistent matching:', {
          totalCount: convertedTemplates.length,
          types: [...new Set(convertedTemplates.map(t => t.template_type))]
        });
      } catch (error) {
        console.error('❌ Failed to load templates from database:', error);
        setDatabaseTemplates([]);
      }
    };
    
    loadAllTemplates();
  }, []);
  
  // Use window templates (selected from package) or fall back to database templates
  const pngTemplates = windowTemplates.length > 0 ? windowTemplates : databaseTemplates;
  
  // Find PNG template using slot's templateType for better accuracy after swaps
  const templateType = slots[0]?.templateType || template.id;
  
  // STATE GUARD: Prevent rendering with mismatched template data during navigation
  // Skip validation during user-initiated apply actions to prevent loading flash
  const isDataConsistent = skipStateGuard || slots.every((slot: any) => {
    const slotTemplateType = slot.templateType || slot.templateId?.split('_')[0];
    return !slotTemplateType || slotTemplateType === templateType || slotTemplateType === template.id;
  });
  
  if (!isDataConsistent) {
    console.warn('🛡️ STATE GUARD - Blocking render due to mismatched template data:', {
      expectedTemplateType: templateType,
      templateId: template.id,
      slotTemplateTypes: slots.map((s: any) => s.templateType),
      reason: 'Template data mismatch during navigation - waiting for consistent state'
    });
    // Return a simple loading state instead of rendering with wrong data
    return <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded">
      <div className="text-gray-500">Loading...</div>
    </div>;
  }
  
  // NAVIGATION DEBUG: Track what we receive each time this component renders
  console.log('🔄 NAVIGATION DEBUG - TemplateVisualWrapper render:', {
    timestamp: new Date().toISOString(),
    templateId: template.id,
    templateName: template.name,
    derivedTemplateType: templateType,
    slotsCount: slots.length,
    pngTemplatesAvailable: pngTemplates.length,
  });
  
  // ENHANCED: Safety check with detailed template type analysis
  if (pngTemplates.length === 0) {
    console.error('🚨 CRITICAL ERROR - No PNG templates found in window.pngTemplates');
    console.log('🔧 This will cause template swapping to fail. Check hybridTemplateService loading.');
  }
  
  // Strict template matching - NO fallbacks, NO hardcoding
  let pngTemplate = null;
  
  if (pngTemplates.length > 0 && templateType) {
    // Find exact template by ID (templateType now contains the unique template ID)
    // First try direct UUID match, then fall back to type+size matching for compatibility
    let candidateTemplate = pngTemplates.find((t: any) => t.id === templateType || t.id.toString() === templateType);
    
    // If not found by UUID, try matching by template_type and print_size (for dynamically added templates)
    if (!candidateTemplate && slots[0]) {
      candidateTemplate = pngTemplates.find((t: any) => 
        t.template_type === slots[0].templateType && 
        t.print_size === slots[0].printSize
      );
      console.log('🔄 Fallback template matching by type+size:', {
        searchedType: slots[0].templateType,
        searchedSize: slots[0].printSize,
        found: !!candidateTemplate,
        candidateName: candidateTemplate?.name
      });
    }
    
    if (candidateTemplate) {
      // Strict compatibility check: template holes must match expected slots
      const templateHoles = candidateTemplate.holes?.length || 0;
      const expectedSlots = slots.length;
      
      if (templateHoles === expectedSlots) {
        pngTemplate = candidateTemplate;
        console.log('✅ Compatible template found:', {
          templateName: pngTemplate.name,
          templateType: pngTemplate.template_type,
          holes: templateHoles,
          slots: expectedSlots,
          compatible: true
        });
      } else {
        console.error('❌ TEMPLATE INCOMPATIBLE - Hole count mismatch:', {
          templateName: candidateTemplate.name,
          templateType: candidateTemplate.template_type,
          templateHoles: templateHoles,
          expectedSlots: expectedSlots,
          compatible: false,
          willShowError: true
        });
      }
    } else {
      console.error('❌ NO TEMPLATE MATCH - Template type not found in database:', {
        searchedTemplateType: templateType,
        availableTypes: [...new Set(pngTemplates.map((t: any) => t.template_type))],
        totalTemplatesInDB: pngTemplates.length,
        slotsLookingFor: slots.length,
        thisWillShowError: true
      });
    }
  }

  // Render result: either exact match or error state
  if (pngTemplate) {
    console.log('✅ Rendering exact template match:', pngTemplate.name);
    return (
      <PngTemplateVisual
        pngTemplate={pngTemplate}
        templateSlots={slots}
        onSlotClick={onSlotClick}
        photos={photos}
        selectedSlot={selectedSlot}
        inlineEditingSlot={inlineEditingSlot}
        inlineEditingPhoto={inlineEditingPhoto}
        onInlineApply={onInlineApply}
        onInlineCancel={onInlineCancel}
        isActiveTemplate={isActiveTemplate}
        onDropPhoto={onDropPhoto}
      />
    );
  }

  // No compatible template found - show detailed error state
  const candidateTemplate = pngTemplates.find((t: any) => t.template_type === templateType);
  const availableTypes = [...new Set(pngTemplates.map((t: any) => t.template_type))];
  
  console.log('❌ Template error, showing detailed error state for:', templateType);
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 border-2 border-red-200 rounded-lg p-4">
      <div className="text-red-600 text-4xl mb-4">⚠️</div>
      <h3 className="text-red-800 font-bold text-lg mb-2">Template Issue</h3>
      
      {candidateTemplate ? (
        // Template exists but incompatible
        <div className="text-center">
          <p className="text-red-700 mb-3">
            Template <span className="font-mono bg-red-100 px-2 py-1 rounded">{candidateTemplate.name}</span> found but incompatible
          </p>
          <div className="text-sm text-red-600 space-y-1">
            <p>Template holes: <span className="font-bold">{candidateTemplate.holes?.length || 0}</span></p>
            <p>Expected slots: <span className="font-bold">{slots.length}</span></p>
            <p className="mt-3 font-medium">Hole count must match slot count exactly.</p>
          </div>
        </div>
      ) : (
        // Template type not found
        <div className="text-center">
          <p className="text-red-700 mb-3">
            No template found for type: <span className="font-mono bg-red-100 px-2 py-1 rounded">{templateType}</span>
          </p>
          <div className="text-sm text-red-600">
            <p>Available types: {availableTypes.length > 0 ? availableTypes.join(', ') : 'None'}</p>
            <p className="mt-2">Please add a <strong>{templateType}</strong> template to the database.</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Export memoized component to prevent unnecessary re-renders
export default React.memo(TemplateVisualWrapper);