import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { templateExportService } from '../services/templateExportService';
import { TemplateExportOptions, TemplateType, PrintSize } from '../types';

interface TemplateExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TemplateExportModal({ isOpen, onClose }: TemplateExportModalProps) {
  const [exportOptions, setExportOptions] = useState<TemplateExportOptions>({
    format: 'zip',
    includePngFiles: true,
    includeBase64Data: false,
    activeOnly: true
  });
  
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const handleExportAll = async () => {
    setIsExporting(true);
    setExportStatus({ type: null, message: '' });
    
    try {
      const blob = await templateExportService.exportAllTemplates(exportOptions);
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `template-export-${timestamp}.${exportOptions.format}`;
      
      await templateExportService.downloadExport(blob, filename);
      
      setExportStatus({
        type: 'success',
        message: `Templates exported successfully as ${filename}`
      });
      
      setTimeout(() => {
        onClose();
        setExportStatus({ type: null, message: '' });
      }, 2000);
      
    } catch (error) {
      console.error('Export failed:', error);
      setExportStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Export failed'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportByType = async (type: TemplateType) => {
    setIsExporting(true);
    setExportStatus({ type: null, message: '' });
    
    try {
      const blob = await templateExportService.exportTemplatesByType(type, exportOptions);
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `template-export-${type}-${timestamp}.${exportOptions.format}`;
      
      await templateExportService.downloadExport(blob, filename);
      
      setExportStatus({
        type: 'success',
        message: `${type} templates exported successfully`
      });
      
    } catch (error) {
      console.error('Export failed:', error);
      setExportStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Export failed'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportBySize = async (size: PrintSize) => {
    setIsExporting(true);
    setExportStatus({ type: null, message: '' });
    
    try {
      const blob = await templateExportService.exportTemplatesBySize(size, exportOptions);
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `template-export-${size}-${timestamp}.${exportOptions.format}`;
      
      await templateExportService.downloadExport(blob, filename);
      
      setExportStatus({
        type: 'success',
        message: `${size} templates exported successfully`
      });
      
    } catch (error) {
      console.error('Export failed:', error);
      setExportStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Export failed'
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                  Export PNG Templates
                </Dialog.Title>

                {/* Export Options */}
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Export Format
                    </label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="format"
                          value="zip"
                          checked={exportOptions.format === 'zip'}
                          onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value as 'zip' | 'json' }))}
                          className="mr-2"
                        />
                        ZIP Archive (recommended)
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="format"
                          value="json"
                          checked={exportOptions.format === 'json'}
                          onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value as 'zip' | 'json' }))}
                          className="mr-2"
                        />
                        JSON Only
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={exportOptions.includePngFiles}
                        onChange={(e) => setExportOptions(prev => ({ ...prev, includePngFiles: e.target.checked }))}
                        className="mr-2"
                      />
                      Include PNG Files
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={exportOptions.includeBase64Data}
                        onChange={(e) => setExportOptions(prev => ({ ...prev, includeBase64Data: e.target.checked }))}
                        className="mr-2"
                      />
                      Include Base64 Data
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={exportOptions.activeOnly}
                        onChange={(e) => setExportOptions(prev => ({ ...prev, activeOnly: e.target.checked }))}
                        className="mr-2"
                      />
                      Active Templates Only
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Template Sources
                    </label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={!exportOptions.sources || exportOptions.sources.includes('manual')}
                          onChange={(e) => {
                            const sources = exportOptions.sources || ['manual', 'auto-detected'];
                            if (e.target.checked) {
                              setExportOptions(prev => ({ 
                                ...prev, 
                                sources: [...(sources.filter(s => s !== 'manual')), 'manual']
                              }));
                            } else {
                              setExportOptions(prev => ({ 
                                ...prev, 
                                sources: sources.filter(s => s !== 'manual')
                              }));
                            }
                          }}
                          className="mr-2"
                        />
                        Manual Templates
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={!exportOptions.sources || exportOptions.sources.includes('auto-detected')}
                          onChange={(e) => {
                            const sources = exportOptions.sources || ['manual', 'auto-detected'];
                            if (e.target.checked) {
                              setExportOptions(prev => ({ 
                                ...prev, 
                                sources: [...(sources.filter(s => s !== 'auto-detected')), 'auto-detected']
                              }));
                            } else {
                              setExportOptions(prev => ({ 
                                ...prev, 
                                sources: sources.filter(s => s !== 'auto-detected')
                              }));
                            }
                          }}
                          className="mr-2"
                        />
                        Auto-Detected Templates
                      </label>
                    </div>
                  </div>
                </div>

                {/* Status Message */}
                {exportStatus.type && (
                  <div className={`p-3 rounded-lg mb-4 ${
                    exportStatus.type === 'success' 
                      ? 'bg-green-50 text-green-800 border border-green-200' 
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    {exportStatus.message}
                  </div>
                )}

                {/* Export Buttons */}
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Export All Templates</h4>
                    <button
                      onClick={handleExportAll}
                      disabled={isExporting}
                      className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isExporting ? 'Exporting...' : 'Export All Templates'}
                    </button>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Export by Template Type</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {(['solo', 'collage', 'photocard', 'photostrip'] as TemplateType[]).map(type => (
                        <button
                          key={type}
                          onClick={() => handleExportByType(type)}
                          disabled={isExporting}
                          className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed capitalize"
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Export by Print Size</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {(['4R', '5R', 'A4'] as PrintSize[]).map(size => (
                        <button
                          key={size}
                          onClick={() => handleExportBySize(size)}
                          disabled={isExporting}
                          className="bg-purple-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    onClick={onClose}
                    disabled={isExporting}
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}