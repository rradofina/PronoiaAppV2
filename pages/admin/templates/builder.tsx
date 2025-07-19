import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../../components/admin/AdminLayout';
import { useAdminStore } from '../../../stores/adminStore';
import { CustomPhotoSlot, PrintSize, CustomTemplate } from '../../../types';
import { PRINT_SIZES } from '../../../utils/constants';

interface CanvasSlot extends CustomPhotoSlot {
  isSelected: boolean;
  isDragging: boolean;
}

interface CanvasState {
  zoom: number;
  panX: number;
  panY: number;
  showGrid: boolean;
  gridSize: number;
}

export default function TemplateBuilder() {
  const router = useRouter();
  const { mode, id } = router.query;
  
  const {
    builderMode,
    builderTemplate,
    selectedPrintSize,
    isLoading,
    isSaving,
    error,
    successMessage,
    setBuilderMode,
    setSelectedPrintSize,
    saveCustomTemplate,
    loadCustomTemplate,
    clearMessages,
  } = useAdminStore();

  // Local state for canvas and template editing
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateCategory, setTemplateCategory] = useState('');
  const [templateTags, setTemplateTags] = useState<string[]>([]);
  const [photoSlots, setPhotoSlots] = useState<CanvasSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [canvas, setCanvas] = useState<CanvasState>({
    zoom: 1,
    panX: 0,
    panY: 0,
    showGrid: true,
    gridSize: 20,
  });
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Initialize builder based on mode
  useEffect(() => {
    if (mode && typeof mode === 'string') {
      setBuilderMode(mode as 'create' | 'edit' | 'duplicate');
      
      if (mode === 'edit' && id && typeof id === 'string') {
        loadCustomTemplate(id);
      }
    } else {
      setBuilderMode('create');
    }
  }, [mode, id, setBuilderMode, loadCustomTemplate]);

  // Load template data when builderTemplate changes
  useEffect(() => {
    if (builderTemplate) {
      setTemplateName(builderTemplate.name || '');
      setTemplateDescription(builderTemplate.description || '');
      setTemplateCategory(builderTemplate.category || '');
      setTemplateTags(builderTemplate.tags || []);
      setSelectedPrintSize(builderTemplate.print_size || '4R');
      
      if (builderTemplate.photo_slots) {
        const slots: CanvasSlot[] = builderTemplate.photo_slots.map((slot, index) => ({
          ...slot,
          id: slot.id || `slot_${index}`,
          isSelected: false,
          isDragging: false,
        }));
        setPhotoSlots(slots);
      }
    }
  }, [builderTemplate, setSelectedPrintSize]);

  // Get current print size configuration
  const currentPrintSize = PRINT_SIZES[selectedPrintSize];
  const canvasWidth = currentPrintSize?.dimensions.width || 1200;
  const canvasHeight = currentPrintSize?.dimensions.height || 1800;

  // Canvas scale for display (fit to container)
  const canvasDisplayWidth = 400;
  const canvasDisplayHeight = (canvasDisplayWidth * canvasHeight) / canvasWidth;
  const displayScale = canvasDisplayWidth / canvasWidth;

  // Add new photo slot
  const addPhotoSlot = useCallback(() => {
    const newSlot: CanvasSlot = {
      id: `slot_${Date.now()}`,
      index: photoSlots.length,
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      isSelected: false,
      isDragging: false,
    };
    setPhotoSlots(prev => [...prev, newSlot]);
    setSelectedSlotId(newSlot.id);
  }, [photoSlots.length]);

  // Delete selected photo slot
  const deleteSelectedSlot = useCallback(() => {
    if (selectedSlotId) {
      setPhotoSlots(prev => prev.filter(slot => slot.id !== selectedSlotId));
      setSelectedSlotId(null);
    }
  }, [selectedSlotId]);

  // Handle slot selection
  const selectSlot = useCallback((slotId: string) => {
    setSelectedSlotId(slotId);
    setPhotoSlots(prev => prev.map(slot => ({
      ...slot,
      isSelected: slot.id === slotId
    })));
  }, []);

  // Handle slot drag
  const handleSlotMouseDown = useCallback((e: React.MouseEvent, slotId: string) => {
    e.stopPropagation();
    selectSlot(slotId);
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    
    setPhotoSlots(prev => prev.map(slot => ({
      ...slot,
      isDragging: slot.id === slotId
    })));
  }, [selectSlot]);

  // Handle mouse move for dragging
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !selectedSlotId) return;

    const deltaX = (e.clientX - dragStart.x) / displayScale / canvas.zoom;
    const deltaY = (e.clientY - dragStart.y) / displayScale / canvas.zoom;

    setPhotoSlots(prev => prev.map(slot => {
      if (slot.id === selectedSlotId) {
        let newX = slot.x + deltaX;
        let newY = slot.y + deltaY;

        // Snap to grid if enabled
        if (canvas.showGrid) {
          newX = Math.round(newX / canvas.gridSize) * canvas.gridSize;
          newY = Math.round(newY / canvas.gridSize) * canvas.gridSize;
        }

        // Keep within canvas bounds
        newX = Math.max(0, Math.min(canvasWidth - slot.width, newX));
        newY = Math.max(0, Math.min(canvasHeight - slot.height, newY));

        return { ...slot, x: newX, y: newY };
      }
      return slot;
    }));

    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, selectedSlotId, dragStart, displayScale, canvas.zoom, canvas.showGrid, canvas.gridSize, canvasWidth, canvasHeight]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setPhotoSlots(prev => prev.map(slot => ({
      ...slot,
      isDragging: false
    })));
  }, []);

  // Save template
  const handleSave = useCallback(async () => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }

    const templateData: Partial<CustomTemplate> = {
      name: templateName.trim(),
      description: templateDescription.trim(),
      print_size: selectedPrintSize,
      orientation: canvasWidth > canvasHeight ? 'landscape' : 'portrait',
      layout_data: {
        type: 'custom',
        width: canvasWidth,
        height: canvasHeight,
        zoom: canvas.zoom,
        gridSize: canvas.gridSize,
      } as any,
      photo_slots: photoSlots.map((slot) => {
        // Remove UI-only properties before saving
        const cleanSlot = { ...slot };
        delete (cleanSlot as any).isSelected;
        delete (cleanSlot as any).isDragging;
        return cleanSlot;
      }),
      dimensions: currentPrintSize.dimensions,
      category: templateCategory || undefined,
      tags: templateTags.length > 0 ? templateTags : undefined,
      is_active: true,
      is_default: false,
    };

    if (builderMode === 'edit' && builderTemplate?.id) {
      // Update existing template
      await saveCustomTemplate(builderTemplate.id, templateData);
    } else {
      // Create new template
      await saveCustomTemplate(null, templateData);
    }

    if (!error) {
      // Navigate back to template management after successful save
      router.push('/admin/templates');
    }
  }, [templateName, templateDescription, selectedPrintSize, canvasWidth, canvasHeight, canvas, photoSlots, currentPrintSize, templateCategory, templateTags, builderMode, builderTemplate?.id, saveCustomTemplate, error, router]);

  // Zoom controls
  const zoomIn = () => setCanvas(prev => ({ ...prev, zoom: Math.min(prev.zoom * 1.2, 3) }));
  const zoomOut = () => setCanvas(prev => ({ ...prev, zoom: Math.max(prev.zoom / 1.2, 0.3) }));
  const resetZoom = () => setCanvas(prev => ({ ...prev, zoom: 1, panX: 0, panY: 0 }));

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading template builder...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/admin/templates')}
              className="text-gray-600 hover:text-gray-800"
            >
              ← Back to Templates
            </button>
            <h1 className="text-xl font-bold text-gray-800">
              {builderMode === 'edit' ? 'Edit Template' : 
               builderMode === 'duplicate' ? 'Duplicate Template' : 
               'Create New Template'}
            </h1>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSave}
              disabled={isSaving || !templateName.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 p-3 mx-4 mt-4 rounded flex items-center justify-between">
            <span className="text-red-700">{error}</span>
            <button onClick={clearMessages} className="text-red-500 hover:text-red-700">✕</button>
          </div>
        )}
        
        {successMessage && (
          <div className="bg-green-50 border border-green-200 p-3 mx-4 mt-4 rounded flex items-center justify-between">
            <span className="text-green-700">{successMessage}</span>
            <button onClick={clearMessages} className="text-green-500 hover:text-green-700">✕</button>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Template Properties */}
          <div className="w-80 bg-white border-r border-gray-200 p-4 overflow-y-auto">
            <div className="space-y-6">
              {/* Template Basic Info */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">Template Properties</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Template Name *
                    </label>
                    <input
                      type="text"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      placeholder="Enter template name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={templateDescription}
                      onChange={(e) => setTemplateDescription(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm h-20 resize-none"
                      placeholder="Template description"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Print Size
                    </label>
                    <select
                      value={selectedPrintSize}
                      onChange={(e) => setSelectedPrintSize(e.target.value as PrintSize)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    >
                      {Object.entries(PRINT_SIZES).map(([key, size]) => (
                        <option key={key} value={key}>
                          {size.label} - {size.dimensions.inches.width}×{size.dimensions.inches.height}&quot;
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      value={templateCategory}
                      onChange={(e) => setTemplateCategory(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      placeholder="e.g., Portrait, Landscape, Event"
                    />
                  </div>
                </div>
              </div>

              {/* Photo Slot Tools */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">Photo Slots</h3>
                <div className="space-y-2">
                  <button
                    onClick={addPhotoSlot}
                    className="w-full bg-blue-600 text-white py-2 px-3 rounded text-sm hover:bg-blue-700"
                  >
                    + Add Photo Slot
                  </button>
                  
                  {selectedSlotId && (
                    <button
                      onClick={deleteSelectedSlot}
                      className="w-full bg-red-600 text-white py-2 px-3 rounded text-sm hover:bg-red-700"
                    >
                      Delete Selected Slot
                    </button>
                  )}
                  
                  <div className="text-xs text-gray-600">
                    Total slots: {photoSlots.length}
                  </div>
                </div>
              </div>

              {/* Canvas Controls */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">Canvas Controls</h3>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={zoomOut}
                      className="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded text-sm"
                    >
                      -
                    </button>
                    <span className="text-sm text-gray-600 flex-1 text-center">
                      Zoom: {Math.round(canvas.zoom * 100)}%
                    </span>
                    <button
                      onClick={zoomIn}
                      className="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded text-sm"
                    >
                      +
                    </button>
                  </div>
                  
                  <button
                    onClick={resetZoom}
                    className="w-full bg-gray-200 hover:bg-gray-300 py-1 px-3 rounded text-sm"
                  >
                    Reset View
                  </button>
                  
                  <label className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={canvas.showGrid}
                      onChange={(e) => setCanvas(prev => ({ ...prev, showGrid: e.target.checked }))}
                      className="rounded"
                    />
                    <span>Show Grid</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Center Canvas Area */}
          <div className="flex-1 bg-gray-100 overflow-hidden relative">
            <div className="h-full flex items-center justify-center p-4">
              <div
                ref={canvasRef}
                className="relative bg-white shadow-lg border border-gray-300"
                style={{
                  width: canvasDisplayWidth * canvas.zoom,
                  height: canvasDisplayHeight * canvas.zoom,
                  transform: `translate(${canvas.panX}px, ${canvas.panY}px)`,
                }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* Grid */}
                {canvas.showGrid && (
                  <div className="absolute inset-0 pointer-events-none">
                    <svg width="100%" height="100%">
                      <defs>
                        <pattern
                          id="grid"
                          width={canvas.gridSize * displayScale * canvas.zoom}
                          height={canvas.gridSize * displayScale * canvas.zoom}
                          patternUnits="userSpaceOnUse"
                        >
                          <path
                            d={`M ${canvas.gridSize * displayScale * canvas.zoom} 0 L 0 0 0 ${canvas.gridSize * displayScale * canvas.zoom}`}
                            fill="none"
                            stroke="#e5e7eb"
                            strokeWidth="1"
                          />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#grid)" />
                    </svg>
                  </div>
                )}

                {/* Photo Slots */}
                {photoSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className={`absolute border-2 cursor-move transition-colors ${
                      slot.isSelected 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-400 bg-gray-50 hover:border-gray-600'
                    } ${slot.isDragging ? 'shadow-lg' : ''}`}
                    style={{
                      left: slot.x * displayScale * canvas.zoom,
                      top: slot.y * displayScale * canvas.zoom,
                      width: slot.width * displayScale * canvas.zoom,
                      height: slot.height * displayScale * canvas.zoom,
                    }}
                    onMouseDown={(e) => handleSlotMouseDown(e, slot.id)}
                  >
                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                      <div className="text-center">
                        <div className="text-lg">📷</div>
                        <div className="text-xs">Slot {slot.index + 1}</div>
                      </div>
                    </div>
                    
                    {/* Resize handles */}
                    {slot.isSelected && (
                      <>
                        <div className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 border border-white rounded-full cursor-nw-resize" />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 border border-white rounded-full cursor-ne-resize" />
                        <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 border border-white rounded-full cursor-sw-resize" />
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 border border-white rounded-full cursor-se-resize" />
                      </>
                    )}
                  </div>
                ))}

                {/* Canvas Info */}
                <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                  {currentPrintSize?.label} ({canvasWidth}×{canvasHeight}px)
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar - Selected Slot Properties */}
          {selectedSlotId && (
            <div className="w-64 bg-white border-l border-gray-200 p-4">
              <h3 className="font-semibold text-gray-800 mb-3">Slot Properties</h3>
              {(() => {
                const selectedSlot = photoSlots.find(s => s.id === selectedSlotId);
                if (!selectedSlot) return null;
                
                return (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Position X
                      </label>
                      <input
                        type="number"
                        value={Math.round(selectedSlot.x)}
                        onChange={(e) => {
                          const newX = parseInt(e.target.value) || 0;
                          setPhotoSlots(prev => prev.map(slot => 
                            slot.id === selectedSlotId ? { ...slot, x: newX } : slot
                          ));
                        }}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Position Y
                      </label>
                      <input
                        type="number"
                        value={Math.round(selectedSlot.y)}
                        onChange={(e) => {
                          const newY = parseInt(e.target.value) || 0;
                          setPhotoSlots(prev => prev.map(slot => 
                            slot.id === selectedSlotId ? { ...slot, y: newY } : slot
                          ));
                        }}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Width
                      </label>
                      <input
                        type="number"
                        value={Math.round(selectedSlot.width)}
                        onChange={(e) => {
                          const newWidth = parseInt(e.target.value) || 100;
                          setPhotoSlots(prev => prev.map(slot => 
                            slot.id === selectedSlotId ? { ...slot, width: newWidth } : slot
                          ));
                        }}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Height
                      </label>
                      <input
                        type="number"
                        value={Math.round(selectedSlot.height)}
                        onChange={(e) => {
                          const newHeight = parseInt(e.target.value) || 100;
                          setPhotoSlots(prev => prev.map(slot => 
                            slot.id === selectedSlotId ? { ...slot, height: newHeight } : slot
                          ));
                        }}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}