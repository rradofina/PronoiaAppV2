/**
 * Hook to initialize template types from database on app startup
 */

import { useEffect } from 'react';
import useTemplateStore from '../stores/templateStore';

export const useTemplateInitialization = () => {
  const { loadTemplateTypes, templateTypes, loadingTemplateTypes } = useTemplateStore();

  useEffect(() => {
    // Load template types on first render if not already loaded
    if (templateTypes.length === 0 && !loadingTemplateTypes) {
      loadTemplateTypes().catch(error => {
        console.error('Failed to initialize template types:', error);
      });
    }
  }, [templateTypes.length, loadingTemplateTypes, loadTemplateTypes]);

  return {
    templateTypes,
    loadingTemplateTypes,
    refreshTemplateTypes: useTemplateStore().refreshTemplateTypes
  };
};