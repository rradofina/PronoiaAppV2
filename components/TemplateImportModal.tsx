import React, { useState, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { templateExportService } from '../services/templateExportService';
import { TemplateImportResult } from '../types';

interface TemplateImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (result: TemplateImportResult) => void;
}

export default function TemplateImportModal({ 
  isOpen, 
  onClose, 
  onImportComplete 
}: TemplateImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
  } | null>(null);
  const [importResult, setImportResult] = useState<TemplateImportResult | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setValidationResult(null);
      return;
    }

    setSelectedFile(file);
    setValidationResult(null);
    setImportResult(null);
    
    // Validate file
    setIsValidating(true);
    try {
      const validation = await templateExportService.validateExportFile(file);
      setValidationResult(validation);
    } catch (error) {
      setValidationResult({
        valid: false,
        errors: [error instanceof Error ? error.message : 'Validation failed']
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !validationResult?.valid) return;

    setIsImporting(true);
    setImportResult(null);
    
    try {
      const result = await templateExportService.importFromExport(selectedFile);
      setImportResult(result);
      onImportComplete?.(result);
      
      if (result.success && result.errorCount === 0) {
        setTimeout(() => {
          handleClose();
        }, 3000);
      }
    } catch (error) {
      console.error('Import failed:', error);
      setImportResult({
        success: false,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 1,
        errors: [{
          templateId: 'unknown',
          templateName: 'unknown',
          error: error instanceof Error ? error.message : 'Import failed'
        }],
        duplicates: []
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setValidationResult(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const canImport = selectedFile && validationResult?.valid && !isImporting && !isValidating;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
              <Dialog.Panel className="w-full max-w-xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                  Import PNG Templates
                </Dialog.Title>

                {/* File Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Export File
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip,.json"
                    onChange={handleFileSelect}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-medium
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Select a .zip or .json file exported from this application
                  </p>
                </div>

                {/* File Info */}
                {selectedFile && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm">
                      <strong>File:</strong> {selectedFile.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      <strong>Size:</strong> {(selectedFile.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                )}

                {/* Validation Status */}
                {isValidating && (
                  <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg">
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-800 mr-2"></div>
                      Validating file...
                    </div>
                  </div>
                )}

                {validationResult && (
                  <div className={`mb-4 p-3 rounded-lg ${
                    validationResult.valid 
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    {validationResult.valid ? (
                      <div className="flex items-center">
                        <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        File is valid and ready to import
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center mb-2">
                          <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          File validation failed
                        </div>
                        <ul className="text-sm list-disc list-inside">
                          {validationResult.errors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Import Result */}
                {importResult && (
                  <div className={`mb-4 p-3 rounded-lg ${
                    importResult.success && importResult.errorCount === 0
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : importResult.errorCount > 0
                      ? 'bg-red-50 text-red-800 border border-red-200'
                      : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                  }`}>
                    <div className="text-sm space-y-1">
                      <div><strong>Import Summary:</strong></div>
                      <div>• Imported: {importResult.importedCount} templates</div>
                      <div>• Skipped: {importResult.skippedCount} templates</div>
                      <div>• Errors: {importResult.errorCount} templates</div>
                      
                      {importResult.duplicates.length > 0 && (
                        <div>• Duplicates: {importResult.duplicates.length} templates</div>
                      )}
                      
                      {importResult.errors.length > 0 && (
                        <div className="mt-2">
                          <strong>Errors:</strong>
                          <ul className="list-disc list-inside ml-2">
                            {importResult.errors.map((error, index) => (
                              <li key={index}>{error.templateName}: {error.error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Import Button */}
                <div className="mb-6">
                  <button
                    onClick={handleImport}
                    disabled={!canImport}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isImporting ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Importing Templates...
                      </div>
                    ) : (
                      'Import Templates'
                    )}
                  </button>
                </div>

                {/* Footer */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    onClick={handleClose}
                    disabled={isImporting}
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