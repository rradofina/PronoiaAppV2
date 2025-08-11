// Updated: Latest version with template modals and tablet optimization..
import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import useAuthStore from '../stores/authStore';
import useDriveStore from '../stores/driveStore';
import useSessionStore from '../stores/sessionStore';
import useTemplateStore from '../stores/templateStore';
import useUiStore from '../stores/uiStore';
import { DriveFolder, TemplateSlot, Photo, TemplateTypeInfo, Package, TemplateType, ManualTemplate } from '../types';
import DriveSetupScreen from '../components/screens/DriveSetupScreen';
import FolderSelectionScreen from '../components/screens/FolderSelectionScreen';
import PackageSelectionScreen from '../components/screens/PackageSelectionScreen';
import PhotoSelectionScreen from '../components/screens/PhotoSelectionScreen';
import TemplateSetupScreen from '../components/screens/TemplateSetupScreen';
import PngTemplateManagementScreen from '../components/screens/PngTemplateManagementScreen';
import TemplateFolderSelectionScreen from '../components/screens/TemplateFolderSelectionScreen';
import ManualTemplateManagerScreen from '../components/admin/ManualTemplateManagerScreen';
import ManualPackageManagerScreen from '../components/admin/ManualPackageManagerScreen';
import googleDriveService from '../services/googleDriveService';
import { manualTemplateService } from '../services/manualTemplateService';
import { manualPackageService } from '../services/manualPackageService';
import { templateCacheService } from '../services/templateCacheService';
import { printSizeService } from '../services/printSizeService';
import { templateRasterizationService } from '../services/templateRasterizationService';

declare global {
  interface Window {
    gapi: any;
    google: any & {
      accounts?: {
        id: {
          initialize: (config: any) => void;
          prompt: () => void;
          revoke: (hint: string, callback: () => void) => void;
        };
        oauth2?: {
          initTokenClient: (config: any) => any;
        };
      };
    };
  }
}

// Template Visual Component - Database-driven rendering
const TemplateVisual = ({ template, slots, onSlotClick, photos, selectedSlot }: {
  template: { id: string, name: string, slots: number },
  slots: TemplateSlot[],
  onSlotClick: (slot: TemplateSlot) => void,
  photos: Photo[],
  selectedSlot: TemplateSlot | null
}) => {
  const [templateData, setTemplateData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Load template configuration from database
  useEffect(() => {
    const loadTemplateData = async () => {
      try {
        setIsLoading(true);
        // Get template type from the first slot (all slots should have same template type)
        const firstSlot = slots[0];
        if (firstSlot) {
          // Find the template from database using template type and print size
          const allTemplates = await manualTemplateService.getAllTemplates();
          const dbTemplate = allTemplates.find(t => 
            t.template_type === firstSlot.templateType &&
            t.print_size === (firstSlot.printSize || '')
          );
          setTemplateData(dbTemplate || null);
        }
      } catch (error) {
        console.error('Error loading template data in index.tsx:', error);
        setTemplateData(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (slots.length > 0) {
      loadTemplateData();
    } else {
      setIsLoading(false);
    }
  }, [slots, template.id]);

  const getPhotoUrl = (photoId?: string | null) => {
    if (!photoId) return null;
    return photos.find(p => p.id === photoId)?.url || null;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white p-3 rounded-lg shadow-md w-full h-full flex items-center justify-center" style={{ minHeight: '200px' }}>
        <div className="text-center text-gray-500">
          <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
          <div className="text-sm">Loading template...</div>
        </div>
      </div>
    );
  }

  // Error state - no template data found
  if (!templateData) {
    return (
      <div className="bg-white p-3 rounded-lg shadow-md w-full h-full flex items-center justify-center" style={{ minHeight: '200px' }}>
        <div className="text-center text-gray-500">
          <div className="text-lg mb-2">⚠️</div>
          <div className="text-sm">Template not found</div>
          <div className="text-xs text-gray-400 mt-1">
            {slots[0]?.templateType} - {slots[0]?.printSize}
          </div>
        </div>
      </div>
    );
  }

  // Database-driven rendering using holes_data and dimensions
  const { dimensions, holes_data } = templateData;
  const aspectRatio = dimensions.width / dimensions.height;

  return (
    <div 
      className="bg-white p-2 rounded-lg shadow-md w-full h-full relative overflow-hidden" 
      style={{ 
        aspectRatio: aspectRatio.toString(), 
        minHeight: '200px' 
      }}
    >
      {/* Render photo slots based on database holes_data */}
      {holes_data.map((hole: any, index: number) => {
        const slot = slots[index];
        if (!slot) return null;

        // Calculate hole position and size as percentages of template dimensions
        const holeStyle = {
          position: 'absolute' as const,
          left: `${(hole.x / dimensions.width) * 100}%`,
          top: `${(hole.y / dimensions.height) * 100}%`,
          width: `${(hole.width / dimensions.width) * 100}%`,
          height: `${(hole.height / dimensions.height) * 100}%`,
          backgroundImage: getPhotoUrl(slot.photoId) ? `url('${getPhotoUrl(slot.photoId)}')` : 'none',
          backgroundPosition: 'center',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat'
        };

        return (
          <div
            key={slot.id}
            className={`cursor-pointer transition-all duration-200 border-2 border-gray-200 rounded ${
              selectedSlot?.id === slot.id ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:border-gray-300'
            }`}
            style={holeStyle}
            onClick={() => onSlotClick(slot)}
          >
            {!getPhotoUrl(slot.photoId) && (
              <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-50 bg-opacity-80">
                <div className="text-center">
                  <div className="text-sm mb-1">+</div>
                  <div className="text-xs font-medium">Add</div>
                </div>
              </div>
            )}
          </div>
        );
      })}
      
      {/* Template info overlay */}
      <div className="absolute bottom-1 left-1 text-xs text-gray-400 bg-white bg-opacity-80 px-1 rounded">
        {templateData.template_type} • {templateData.print_size}
      </div>
    </div>
  );
};

export default function Home() {
  // Auth Store
  const { googleAuth, isGapiLoaded, setGoogleAuth, setIsGapiLoaded, syncWithSupabase } = useAuthStore();
  
  // Drive Store
  const { mainSessionsFolder, setMainSessionsFolder, photos, setPhotos } = useDriveStore();
  
  // Session Store  
  const { selectedPackage, clientName, setSelectedPackage, setClientName } = useSessionStore();
  
  // Template Store
  const { 
    templateCounts, 
    templateSlots, 
    selectedSlot, 
    setTemplateSlots, 
    setSelectedSlot, 
    handleTemplateCountChange, 
    getTotalTemplateCount, 
    setTemplateCounts 
  } = useTemplateStore();
  
  // UI Store
  const { currentScreen, eventLog, setCurrentScreen, addEvent } = useUiStore();

  // Sync with Supabase when user signs in
  useEffect(() => {
    if (googleAuth.isSignedIn && googleAuth.userEmail) {
      const userInfo = {
        id: googleAuth.userEmail, // Use email as ID fallback
        email: googleAuth.userEmail,
        name: googleAuth.userEmail.split('@')[0], // Use email prefix as name fallback
      };
      syncWithSupabase(userInfo);
    }
  }, [googleAuth, syncWithSupabase]);

  const [driveFolders, setDriveFolders] = useState<DriveFolder[]>([]);
  const [clientFolders, setClientFolders] = useState<DriveFolder[]>([]);
  const [selectedMainFolder, setSelectedMainFolder] = useState<DriveFolder | null>(null);
  const [selectedClientFolder, setSelectedClientFolder] = useState<DriveFolder | null>(null);
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [localPhotos, setLocalPhotos] = useState<Photo[]>([]);
  const [isRestoringAuth, setIsRestoringAuth] = useState(false);
  const [additionalPrints, setAdditionalPrints] = useState(0);
  const [templateRefreshTrigger, setTemplateRefreshTrigger] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [printsFolderId, setPrintsFolderId] = useState<string | null>(null);
  const [showExistingPrintsDialog, setShowExistingPrintsDialog] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; templateName: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Load main folder from localStorage on initial render
  useEffect(() => {
    const savedFolder = localStorage.getItem('mainSessionsFolder');
    const savedToken = localStorage.getItem('google_access_token');
    const tokenExpiry = localStorage.getItem('google_token_expiry');
    
    if (savedFolder) {
      const folderData = JSON.parse(savedFolder);
      setMainSessionsFolder(folderData);
      setSelectedMainFolder({ id: folderData.id, name: folderData.name, createdTime: '' });
      
      // If we have both a saved folder and valid token, set screen to folder-selection immediately
      if (savedToken && tokenExpiry) {
        const expiryTime = parseInt(tokenExpiry);
        const currentTime = Date.now();
        
        // Check if token is still valid (with 5 minute buffer)
        if (currentTime < expiryTime - 300000) {
          setCurrentScreen('folder-selection');
          // Automatically load client folders
          const loadClientFolders = async () => {
            try {
              if (window.gapi && window.gapi.client && window.gapi.client.drive) {
                const response = await window.gapi.client.drive.files.list({
                  q: `'${folderData.id}' in parents and mimeType='application/vnd.google-apps.folder'`,
                  fields: 'files(id, name, createdTime)',
                  orderBy: 'name'
                });
                setClientFolders(response.result.files || []);
              } else {
                console.warn('Google API not fully loaded yet, skipping auto-load');
              }
            } catch (error) {
              console.error('Failed to auto-load client folders:', error);
            }
          };
          loadClientFolders();
        }
      }
    }
  }, [setMainSessionsFolder, setCurrentScreen, setSelectedMainFolder, setClientFolders]);

  // Function to validate and restore token
  const restoreAuthFromStorage = async () => {
    const storedToken = localStorage.getItem('google_access_token');
    const storedEmail = localStorage.getItem('google_user_email');
    const tokenExpiry = localStorage.getItem('google_token_expiry');
    
    // Check if stored email is authorized before restoring
    if (storedEmail) {
      const allowedEmails = process.env.NEXT_PUBLIC_ALLOWED_EMAILS?.split(',').map(e => e.trim()) || [];
      
      if (!allowedEmails.includes(storedEmail)) {
        console.log('🚫 Stored email not authorized, clearing auth');
        clearStoredAuth();
        return;
      }
    }
    
    if (storedToken && tokenExpiry) {
      const expiryTime = parseInt(tokenExpiry);
      const currentTime = Date.now();
      
      // Check if token is still valid (with 5 minute buffer)
      if (currentTime < expiryTime - 300000) {
        addEvent('Restoring authentication from localStorage');
        setIsRestoringAuth(true);
        
        try {
          // Set the token in GAPI
          if (window.gapi && window.gapi.client) {
            window.gapi.client.setToken({ access_token: storedToken });
            googleDriveService.setAccessToken(storedToken);
            setGoogleAuth({ isSignedIn: true, userEmail: storedEmail || 'Authenticated' });
            
            // Test the token by loading folders
            await loadDriveFolders();
            addEvent('Authentication restored successfully');
            
            // If we have a main folder, load client folders and ensure we're on folder-selection
            const savedFolder = localStorage.getItem('mainSessionsFolder');
            if (savedFolder) {
              const folderData = JSON.parse(savedFolder);
              setSelectedMainFolder({ id: folderData.id, name: folderData.name, createdTime: '' });
              
              // Always ensure we're on folder-selection screen when we have a main folder
              if (currentScreen !== 'folder-selection') {
                setCurrentScreen('folder-selection');
              }
              
              // Load client folders for the main folder
              try {
                if (window.gapi && window.gapi.client && window.gapi.client.drive) {
                  const response = await window.gapi.client.drive.files.list({
                    q: `'${folderData.id}' in parents and mimeType='application/vnd.google-apps.folder'`,
                    fields: 'files(id, name, createdTime)',
                    orderBy: 'name'
                  });
                  setClientFolders(response.result.files || []);
                } else {
                  console.warn('Google API not fully loaded yet, skipping folder load');
                }
              } catch (error) {
                console.error('Failed to load client folders during auth restoration:', error);
              }
            }
          }
        } catch (error) {
          // Token might be invalid, clear it
          addEvent('Failed to restore authentication, clearing stored token');
          clearStoredAuth();
        } finally {
          setIsRestoringAuth(false);
        }
      } else {
        // Token expired or near expiration, try to refresh
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          // Proceed with restored auth
          // ... similar to existing code ...
        } else {
          clearStoredAuth();
        }
      }
    }
  };

  const clearStoredAuth = () => {
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_user_email');
    localStorage.removeItem('google_token_expiry');
    setGoogleAuth({ isSignedIn: false, userEmail: null });
  };

  // Load Google API
  useEffect(() => {
    addEvent('useEffect for Google API loading triggered');
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
      
    if (!clientId || !apiKey || clientId === 'your_google_client_id_here') {
      console.log('⚠️ Google API credentials not configured');
      addEvent('Google API credentials not configured');
      setIsGapiLoaded(true);
      return;
    }

    // Load GAPI for Drive API calls
    addEvent('Loading GAPI script');
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.onload = () => {
      addEvent('GAPI script loaded');
      window.gapi.load('client', async () => {
        addEvent('GAPI client loading');
        await window.gapi.client.init({
          apiKey: apiKey,
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        setIsGapiLoaded(true);
        console.log('✅ GAPI client initialized');
        addEvent('GAPI client initialized');
        
        // Try to restore authentication after GAPI is loaded
        await restoreAuthFromStorage();
      });
    };
    document.head.appendChild(gapiScript);

    // Load GIS for Sign-In and OAuth
    addEvent('Loading GIS script');
    const gsiScript = document.createElement('script');
    gsiScript.src = 'https://accounts.google.com/gsi/client';
    gsiScript.async = true;
    gsiScript.defer = true;
    gsiScript.onload = () => {
      addEvent('GIS script loaded');
      
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive',
        callback: (tokenResponse: any) => {
          if (tokenResponse && tokenResponse.access_token) {
            addEvent('Token received via backup GIS callback');
            window.gapi.client.setToken({ access_token: tokenResponse.access_token });
            loadDriveFolders();
          }
        },
      });
      setTokenClient(client);

      const hash = window.location.hash.substring(1);
      if (hash.includes('access_token=')) {
        setIsConnecting(true);
      }

      console.log('✅ Google Identity Services initialized');
      addEvent('Google Identity Services initialized');
    };
    document.head.appendChild(gsiScript);
  }, [addEvent, setIsGapiLoaded]);

  const requestDrivePermissionsRedirect = () => {
    addEvent('Using redirect-based OAuth flow');
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      alert('Google Client ID not configured.');
      return;
    }
    
    setIsConnecting(true);

    const redirectUri = window.location.origin;
    const scope = 'https://www.googleapis.com/auth/drive';
    const state = `${Math.random().toString(36).substring(2, 15)}`;
    
    sessionStorage.setItem('oauth_state', state);
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(`${window.location.origin}/api/auth/callback`)}` +
      `&scope=${encodeURIComponent(scope)}` +
      `&response_type=code` +
      `&state=${encodeURIComponent(state)}` +
      `&prompt=consent&access_type=offline&include_granted_scopes=true`;
    
    window.location.href = authUrl;
  };

  const handleGoogleSignIn = () => {
    addEvent('Starting Google Sign-In and permission flow');
    requestDrivePermissionsRedirect();
  };

  const loadDriveFolders = async () => {
    addEvent('Loading Google Drive folders');
    try {
      const response = await window.gapi.client.drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and 'root' in parents",
        fields: 'files(id, name, createdTime)',
        orderBy: 'name'
      });
      setDriveFolders(response.result.files || []);
      
      // Try to get user info if we have a token
      try {
        const aboutResponse = await window.gapi.client.drive.about.get({
          fields: 'user(emailAddress)'
        });
        if (aboutResponse.result.user?.emailAddress) {
          const email = aboutResponse.result.user.emailAddress;
          
          // Check if email is in allowed list
          const allowedEmails = process.env.NEXT_PUBLIC_ALLOWED_EMAILS?.split(',').map(e => e.trim()) || [];
          
          if (!allowedEmails.includes(email)) {
            setError(`Access denied. Your email (${email}) is not authorized to use this application.`);
            handleSignOut();
            return;
          }
          
          localStorage.setItem('google_user_email', email);
          setGoogleAuth({ isSignedIn: true, userEmail: email });
        }
      } catch (e) {
        // Failed to get user info, but that's okay
        addEvent('Could not retrieve user email');
      }
    } catch (error: any) {
      console.error('❌ Failed to load folders:', error);
      let errorMessage = 'Failed to load Google Drive folders.';
      if (error.status === 403) errorMessage = 'Permission denied.';
      else if (error.status === 401) {
        errorMessage = 'Authentication expired.';
        clearStoredAuth();
      }
      alert(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle OAuth redirect callback
  useEffect(() => {
    const handleOAuthRedirect = () => {
      const hash = window.location.hash.substring(1);
      if (hash) {
        addEvent('OAuth redirect callback detected');
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const state = params.get('state');
        const error = params.get('error');
        const storedState = sessionStorage.getItem('oauth_state');
        const expiresIn = params.get('expires_in'); // Usually 3600 seconds (1 hour)
        const refreshToken = params.get('refresh_token'); // New: refresh token

        window.history.replaceState(null, '', window.location.pathname + window.location.search);

        if (error) {
            alert(`Failed to get Google Drive permissions. Error: ${error}`);
            setIsConnecting(false);
            return;
        }
        
        if (state !== storedState) {
            alert('Security error: state mismatch. Please try again.');
            setIsConnecting(false);
            return;
        }

        if (accessToken) {
          addEvent('OAuth redirect successful, setting access token');
          window.gapi.client.setToken({ access_token: accessToken });
          googleDriveService.setAccessToken(accessToken);
          sessionStorage.removeItem('oauth_state');
          
          // Store token in localStorage with expiry time
          const expiryTime = Date.now() + (parseInt(expiresIn || '3600') * 1000);
          localStorage.setItem('google_access_token', accessToken);
          localStorage.setItem('google_token_expiry', expiryTime.toString());
          
          // New: Store refresh token if available
          if (refreshToken) {
            localStorage.setItem('google_refresh_token', refreshToken);
          }
          
          // Note: We'll try to get the email after loading folders
          
          setGoogleAuth({ isSignedIn: true, userEmail: 'Authenticated' });
          loadDriveFolders();
        } else {
          setIsConnecting(false);
        }
      }
    };
    
    if (isGapiLoaded && !isRestoringAuth) {
      handleOAuthRedirect();
    }
  }, [isGapiLoaded, addEvent, setGoogleAuth, isRestoringAuth]);

  const handleMainFolderSelect = async (folder: DriveFolder) => {
    addEvent(`Main folder selected: ${folder.name}`);
    setSelectedMainFolder(folder);
    setMainSessionsFolder({ id: folder.id, name: folder.name });
    
    // Save to localStorage
    localStorage.setItem('mainSessionsFolder', JSON.stringify({ id: folder.id, name: folder.name }));
    
    try {
      const response = await window.gapi.client.drive.files.list({
        q: `'${folder.id}' in parents and mimeType='application/vnd.google-apps.folder'`,
        fields: 'files(id, name, createdTime)',
        orderBy: 'name'
      });
      setClientFolders(response.result.files || []);
      setCurrentScreen('folder-selection');
    } catch (error) {
      console.error('Failed to load client folders:', error);
      alert('Failed to load client folders. Please try again.');
    }
  };

  const handleClientFolderSelect = async (folder: DriveFolder) => {
    console.log('📂 handleClientFolderSelect called with folder:', folder.name);
    setSelectedClientFolder(folder);
    setClientName(folder.name);
    try {
      console.log(`📥 Loading photos from folder: ${folder.name} (${folder.id})`);
      
      // Use our Google Drive service instead of raw API
      const drivePhotos = await googleDriveService.getPhotosFromFolder(folder.id);
      console.log(`✅ Loaded ${drivePhotos.length} photos from folder. Sample:`, drivePhotos.slice(0, 2));
      
      // CRITICAL DEBUG: Check if we actually have photos
      if (drivePhotos.length === 0) {
        console.error('❌ NO PHOTOS FOUND IN FOLDER - This is the problem!');
        alert('No photos found in the selected folder. Make sure the folder contains image files.');
        return;
      }
      
      setLocalPhotos(drivePhotos);
      setPhotos(drivePhotos);
      console.log('📦 Photos stored in localPhotos and photos state');
      // Don't change screen here - let the FolderSelectionScreen handle the package selection
      // setCurrentScreen('package'); // Removed - package selection now happens in FolderSelectionScreen
    } catch (error) {
      console.error('❌ Failed to load photos:', error);
      alert('Failed to load photos from the selected folder.');
    }
  };

  const handleSignOut = () => {
    addEvent('User signed out');
    if (tokenClient) {
      const hint = googleAuth.userEmail || '';
      if (window.google?.accounts?.id?.revoke) {
        window.google.accounts.id.revoke(hint, () => {
          console.log('✅ Authorization revoked for:', hint);
          addEvent('Authorization revoked for: ' + hint);
        });
      }
    }
    googleDriveService.signOut();
    clearStoredAuth();
    setGoogleAuth({ isSignedIn: false, userEmail: null });
    setCurrentScreen('drive-setup');
    
    // Clear main folder from localStorage as well
    localStorage.removeItem('mainSessionsFolder');
    setMainSessionsFolder(null);
    
    // Clear other state
    setDriveFolders([]);
    setSelectedMainFolder(null);
    setClientFolders([]);
    setSelectedClientFolder(null);
    setLocalPhotos([]);
    setPhotos([]);
    setSelectedPackage(null);
    setClientName('');
    setTemplateSlots([]);
    setSelectedSlot(null);
  };

  const handleChangeMainFolder = () => {
    addEvent('User wants to change main folder');
    setCurrentScreen('drive-setup');
    setClientFolders([]);
    setSelectedClientFolder(null);
  };

  const handleBack = () => {
    if (currentScreen === 'folder-selection') {
      setCurrentScreen('drive-setup');
      setSelectedMainFolder(null);
      setClientFolders([]);
    } else if (currentScreen === 'package') {
      setCurrentScreen('folder-selection');
      setSelectedClientFolder(null);
      setLocalPhotos([]);
      setPhotos([]);
      setSelectedPackage(null);
      setClientName('');
      setAdditionalPrints(0);
    } else if (currentScreen === 'template') {
      setCurrentScreen('folder-selection'); // Go back to folder selection (which includes package selection)
    } else if (currentScreen === 'photos') {
      setCurrentScreen('folder-selection'); // Go back to folder selection (which includes package selection)
      setTemplateSlots([]);
      setSelectedSlot(null);
    }
  };

  const handlePhotoContinue = async () => {
    console.log('📸 Finalizing photo selections...');
    
    if (!selectedClientFolder) {
      alert('No client folder selected. Please go back and select a folder.');
      return;
    }

    setIsUploading(true);

    try {
      // Create the prints folder name
      const printsFolderName = `Prints - ${selectedClientFolder.name}`;
      
      console.log(`📁 Checking/Creating prints folder: ${printsFolderName}`);
      
      // Check if folder exists and create if needed
      const folderId = await googleDriveService.createOutputFolder(
        selectedClientFolder.id,
        printsFolderName
      );
      
      // Check if folder has content
      const folderContents = await googleDriveService.getFolderContents(folderId);
      
      if (folderContents.files && folderContents.files.length > 0) {
        // Folder has existing prints
        console.log('⚠️ Prints folder already has content');
        setIsUploading(false);
        setShowExistingPrintsDialog(true);
        return;
      }
      
      // Save the prints folder ID for later use
      setPrintsFolderId(folderId);
      
      console.log(`✅ Prints folder ready: ${folderId}`);
      
      // Group templates by templateName for rasterization
      const templateGroups = new Map<string, TemplateSlot[]>();
      templateSlots.forEach(slot => {
        if (!slot.templateName) return;
        if (!templateGroups.has(slot.templateName)) {
          templateGroups.set(slot.templateName, []);
        }
        templateGroups.get(slot.templateName)!.push(slot);
      });

      console.log(`📋 Preparing to rasterize ${templateGroups.size} templates`);
      setUploadProgress({ current: 0, total: templateGroups.size, templateName: 'Preparing...' });

      // Get available print sizes for template lookup
      const availablePrintSizes = await printSizeService.getAvailablePrintSizes();

      let uploadedCount = 0;
      const errors: string[] = [];

      // Process each template group
      for (const [templateName, slots] of templateGroups.entries()) {
        try {
          console.log(`🎨 Rasterizing template: ${templateName}`);
          setUploadProgress({ 
            current: uploadedCount, 
            total: templateGroups.size, 
            templateName: templateName 
          });

          // Find the manual template for this template group
          const firstSlot = slots[0];
          if (!firstSlot) continue;

          // Get all templates to find the matching manual template
          const allTemplates = await manualTemplateService.getAllTemplates();
          const manualTemplate = allTemplates.find(t => 
            t.template_type === firstSlot.templateType && 
            t.print_size === (firstSlot.printSize || (availablePrintSizes.length > 0 ? availablePrintSizes[0].name : ''))
          );

          if (!manualTemplate) {
            console.error(`Manual template not found for type: ${firstSlot.templateType}`);
            errors.push(`Template not found: ${templateName}`);
            continue;
          }

          console.log('📝 Found manual template:', manualTemplate.name);

          // Rasterize the template
          const rasterized = await templateRasterizationService.rasterizeTemplate(
            manualTemplate,
            slots,
            localPhotos,
            {
              format: 'jpeg',
              quality: 0.95,
              includeBackground: true
            }
          );

          console.log(`📤 Uploading template: ${templateName}`);

          // Upload to Google Drive
          const fileName = `${templateName.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
          await googleDriveService.uploadFile(
            rasterized.blob,
            fileName,
            folderId,
            'image/jpeg'
          );

          uploadedCount++;
          console.log(`✅ Uploaded: ${fileName}`);

        } catch (error) {
          console.error(`❌ Failed to process template ${templateName}:`, error);
          errors.push(`Failed: ${templateName}`);
        }
      }

      setUploadProgress(null);
      setIsUploading(false);

      // Show completion message
      if (errors.length > 0) {
        alert(`Templates uploaded with some errors:\n\n✅ Successful: ${uploadedCount}/${templateGroups.size}\n❌ Failed: ${errors.join(', ')}\n\nCheck the prints folder in Google Drive.`);
      } else {
        alert(`✅ All templates uploaded successfully!\n\n${uploadedCount} templates have been saved to the prints folder in Google Drive.`);
      }
      
    } catch (error) {
      console.error('❌ Error during finalization:', error);
      alert('Failed to finalize prints. Please try again.');
      setUploadProgress(null);
      setIsUploading(false);
    }
  };

  const handlePackageContinue = async (effectiveTemplates?: ManualTemplate[]) => {
    if (selectedPackage && clientName.trim()) {
      try {
        const startTime = performance.now();
        
        let orderedTemplates: ManualTemplate[];
        
        if (effectiveTemplates && effectiveTemplates.length > 0) {
          // Use effective templates passed from package selection (includes session changes/additions)
          console.log('📋 Using effective templates from package selection (includes session changes):', {
            templatesCount: effectiveTemplates.length,
            templates: effectiveTemplates.map(t => ({ id: t.id, name: t.name }))
          });
          orderedTemplates = effectiveTemplates;
        } else {
          // Fallback: Load from database (original behavior)
          console.log('📋 Fallback: Loading configured templates from database for manual package:', selectedPackage.name);
          
          const packageWithTemplates = await manualPackageService.getPackageWithTemplates(selectedPackage.id);
          
          if (!packageWithTemplates || !packageWithTemplates.package_templates) {
            throw new Error(`Package ${selectedPackage.name} has no configured templates. Please configure templates in the Package Manager.`);
          }
          
          // Sort templates by order_index to maintain Print #1, Print #2, etc. order
          orderedTemplates = packageWithTemplates.package_templates
            .sort((a, b) => a.order_index - b.order_index)
            .map(pt => pt.template);
        }
        
        console.log(`✅ Found ${orderedTemplates.length} configured templates for package:`, orderedTemplates.map(t => t.name));
        
        // Convert manual templates to hybrid format for compatibility
        const hybridTemplates = orderedTemplates.map(template => ({
          id: template.id,
          name: template.name,
          template_type: template.template_type,
          print_size: template.print_size,
          drive_file_id: template.drive_file_id,
          driveFileId: template.drive_file_id, // Add driveFileId for FullscreenTemplateEditor compatibility
          holes: template.holes_data,
          dimensions: template.dimensions,
          base64_preview: template.base64_preview, // Include base64 preview for instant loading
          source: 'manual' as const
        }));
        
        // Store in window for PhotoSelectionScreen compatibility
        (window as any).pngTemplates = hybridTemplates;
        
        // Skip template preloading for now to avoid timeouts
        // console.log('🎨 Starting template preloading for package...');
        // templateCacheService.preloadPackageTemplates(
        //   orderedTemplates.map(template => ({
        //     id: template.id,
        //     driveFileId: template.drive_file_id,
        //     base64Preview: template.base64_preview
        //   }))
        // ).catch(error => {
        //   console.warn('⚠️ Template preloading failed (non-critical):', error);
        // });
        
        // Create template slots from configured templates
        const slots: TemplateSlot[] = [];
        
        // Add slots for each configured template
        orderedTemplates.forEach((template, templateIndex) => {
          const templateName = `${template.name} (Print #${templateIndex + 1})`;
          
          // Create slots for each hole in the template
          for (let slotIndex = 0; slotIndex < template.holes_data.length; slotIndex++) {
            slots.push({
              id: `${template.id}_${templateIndex}_${slotIndex}`,
              templateId: `${template.id}_${templateIndex}`,
              templateName,
              templateType: template.id.toString(), // Use unique template ID instead of generic type
              printSize: template.print_size,
              slotIndex,
              photoId: undefined
            });
          }
        });
        
        // Add additional prints if requested (repeat the configured templates)
        if (additionalPrints > 0) {
          for (let additionalIndex = 0; additionalIndex < additionalPrints; additionalIndex++) {
            const templateToRepeat = orderedTemplates[additionalIndex % orderedTemplates.length];
            const templateName = `${templateToRepeat.name} (Additional #${additionalIndex + 1})`;
            const templateId = `${templateToRepeat.id}_additional_${additionalIndex}`;
            
            for (let slotIndex = 0; slotIndex < templateToRepeat.holes_data.length; slotIndex++) {
              slots.push({
                id: `${templateId}_${slotIndex}`,
                templateId,
                templateName,
                templateType: templateToRepeat.id.toString(), // Use unique template ID instead of generic type
                printSize: templateToRepeat.print_size,
                slotIndex,
                photoId: undefined
              });
            }
          }
        }
        
        setTemplateSlots(slots);
        const endTime = performance.now();
        console.log(`⚡ Manual package continue completed in ${(endTime - startTime).toFixed(0)}ms with ${slots.length} slots`);
        console.log('📋 Package templates loaded and preloading initiated');
        setCurrentScreen('photos');
      } catch (error) {
        console.error('Error loading package templates:', error);
        alert(`Failed to load templates: ${error instanceof Error ? error.message : 'Please check your template configuration.'}`);
      }
    }
  };


  const handleSlotSelect = (slot: TemplateSlot) => {
    setSelectedSlot(slot);
  };

  const handlePhotoSelect = (photo: Photo) => {
    if (selectedSlot) {
      setTemplateSlots(
        templateSlots.map((slot: TemplateSlot) =>
          slot === selectedSlot
            ? { ...slot, photoId: photo.id }
            : slot
        )
      );
      const currentSlotIndex = templateSlots.findIndex((s: TemplateSlot) => s === selectedSlot);
      const nextEmptySlot = templateSlots.slice(currentSlotIndex + 1).find((s: TemplateSlot) => !s.photoId);
      setSelectedSlot(nextEmptySlot || null);
    }
  };

  // Wrapper function to handle additional prints changes and adjust template counts if needed
  const handleAdditionalPrintsChange = (newAdditionalPrints: number) => {
    setAdditionalPrints(newAdditionalPrints);
    
    // Check if current template count exceeds new total allowed prints
    const newTotalAllowed = (selectedPackage?.templateCount || 0) + newAdditionalPrints;
    const currentTemplateTotal = getTotalTemplateCount();
    
    if (currentTemplateTotal > newTotalAllowed) {
      // Reduce template counts proportionally to fit within new limit
      const reductionNeeded = currentTemplateTotal - newTotalAllowed;
      let remaining = reductionNeeded;
      
      // Create a copy of current template counts
      const newTemplateCounts = { ...templateCounts };
      
      // Reduce from highest counts first
      const sortedTemplates = Object.entries(templateCounts)
        .filter(([, count]) => count > 0)
        .sort(([, a], [, b]) => b - a);
      
      for (const [templateId, count] of sortedTemplates) {
        if (remaining <= 0) break;
        
        const reduction = Math.min(count, remaining);
        newTemplateCounts[templateId] = count - reduction;
        remaining -= reduction;
      }
      
      // Update the template counts
      setTemplateCounts(newTemplateCounts);
    }
  };

  // Helper function to get total allowed prints (base package + additional)
  const getTotalAllowedPrints = () => {
    const basePrints = selectedPackage?.templateCount || 0;
    return basePrints + additionalPrints;
  };

  // Custom template count change handler that accounts for additional prints
  const handleTemplateCountChangeWithAddons = (templateId: string, change: number) => {
    const totalAllowedPrints = getTotalAllowedPrints();
    handleTemplateCountChange(templateId, change, totalAllowedPrints);
  };

  // New: Function to refresh access token using refresh token
  const refreshAccessToken = async () => {
    const refreshToken = localStorage.getItem('google_refresh_token');
    if (!refreshToken) {
      addEvent('No refresh token available, cannot refresh');
      return false;
    }

    try {
      // Call server-side API to refresh token securely
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          refresh_token: refreshToken
        })
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();
      const newAccessToken = data.access_token;
      const newExpiresIn = data.expires_in;

      window.gapi.client.setToken({ access_token: newAccessToken });
      googleDriveService.setAccessToken(newAccessToken);

      const newExpiryTime = Date.now() + (newExpiresIn * 1000);
      localStorage.setItem('google_access_token', newAccessToken);
      localStorage.setItem('google_token_expiry', newExpiryTime.toString());

      addEvent('Access token refreshed successfully');
      return true;
    } catch (error) {
      addEvent('Failed to refresh access token');
      clearStoredAuth();
      return false;
    }
  };

  // Add periodic check for token refresh (e.g., every 30 minutes)
  useEffect(() => {
    const interval = setInterval(async () => {
      const tokenExpiry = localStorage.getItem('google_token_expiry');
      if (tokenExpiry) {
        const expiryTime = parseInt(tokenExpiry);
        if (Date.now() > expiryTime - 600000) { // Refresh if less than 10 minutes left
          await refreshAccessToken();
        }
      }
    }, 1800000); // 30 minutes

    return () => clearInterval(interval);
  }, []);

  // Add inactivity logout (e.g., after 7 days)
  useEffect(() => {
    const checkInactivity = () => {
      const lastActivity = localStorage.getItem('last_activity');
      if (lastActivity) {
        const daysSinceLast = (Date.now() - parseInt(lastActivity)) / (1000 * 60 * 60 * 24);
        if (daysSinceLast > 7) {
          clearStoredAuth();
          setCurrentScreen('drive-setup');
        }
      }
    };

    const updateActivity = () => {
      localStorage.setItem('last_activity', Date.now().toString());
    };

    checkInactivity();
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
    };
  }, []);

  // Load templates from database on app startup - INDEPENDENT of Google API
  useEffect(() => {
    const loadTemplatesFromDatabase = async () => {
      try {
        console.log('🔄 Loading templates from database on app startup...');
        // Use database directly - much simpler and more reliable
        const dbTemplates = await manualTemplateService.getActiveTemplates();
        
        // Convert to format expected by window.pngTemplates with detailed debugging
        console.log('🔄 TEMPLATE CONVERSION - Starting conversion of', dbTemplates.length, 'templates');
        
        const allTemplates = dbTemplates.map((template, index) => {
          console.log(`📝 Converting template ${index + 1}/${dbTemplates.length}:`, {
            id: template.id,
            name: template.name,
            template_type: template.template_type,
            print_size: template.print_size,
            has_holes_data: !!template.holes_data,
            holes_data_length: template.holes_data?.length,
            has_dimensions: !!template.dimensions,
            has_drive_file_id: !!template.drive_file_id
          });
          
          try {
            const convertedTemplate = {
              id: template.id,
              name: template.name,
              description: template.description,
              template_type: template.template_type,
              print_size: template.print_size,
              drive_file_id: template.drive_file_id,
              driveFileId: template.drive_file_id, // Compatibility alias
              holes: template.holes_data,
              dimensions: template.dimensions,
              thumbnail_url: template.thumbnail_url,
              sample_image_url: template.sample_image_url,
              base64_preview: template.base64_preview,
              source: 'manual' as const,
              is_active: template.is_active
            };
            
            console.log(`✅ Successfully converted template: ${template.name}`);
            return convertedTemplate;
          } catch (error) {
            console.error(`❌ Error converting template ${template.name}:`, error);
            return null;
          }
        }).filter(Boolean); // Remove any null templates from conversion errors
        
        console.log('🎯 TEMPLATE CONVERSION COMPLETE:', {
          originalCount: dbTemplates.length,
          convertedCount: allTemplates.length,
          droppedCount: dbTemplates.length - allTemplates.length,
          finalTemplates: allTemplates.map(t => `${t?.name || 'Unknown'} (${t?.template_type || 'Unknown'}, ${t?.print_size || 'Unknown'})`)
        });
        
        // Store all templates globally for fullscreen editor access
        (window as any).pngTemplates = allTemplates;
        
        console.log('✅ PNG templates loaded on startup:', {
          totalTemplates: allTemplates.length,
          templateTypes: allTemplates.map(t => `${t?.name || 'Unknown'} (${t?.template_type || 'Unknown'})`).slice(0, 5),
          printSizes: [...new Set(allTemplates.map(t => t?.print_size).filter(Boolean))],
          templatesByType: allTemplates.reduce((acc, t) => {
            const templateType = t?.template_type || 'Unknown';
            acc[templateType] = (acc[templateType] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          fourRTemplates: allTemplates.filter(t => t?.print_size === '4R').map(t => ({
            name: t?.name || 'Unknown',
            template_type: t?.template_type || 'Unknown',
            source: t?.source || 'Unknown',
            id: t?.id || 'Unknown',
            drive_file_id: t?.drive_file_id || 'Unknown'
          })),
          // Dynamic template types - no hardcoded requirements
          availableTypes: [...new Set(allTemplates.map(t => t?.template_type).filter(Boolean))]
        });
        
        // TEMPLATE TYPE CHECK: Verify template types are loaded (dynamic from database)
        const loadedTypes = [...new Set(allTemplates.map(t => t?.template_type).filter(Boolean))];
        
        console.log('✅ Template types loaded from database:', {
          loadedTypes,
          totalTemplates: allTemplates.length,
          typeBreakdown: loadedTypes.map(type => ({
            type,
            count: allTemplates.filter(t => t && t.template_type === type).length
          }))
        });
      } catch (error) {
        console.warn('⚠️ Failed to load templates from database:', error);
        // Set empty array as fallback
        (window as any).pngTemplates = [];
      }
    };

    // Load templates immediately - no dependencies needed
    loadTemplatesFromDatabase();
  }, []); // Empty dependency array - only run once on app startup

  const renderScreen = () => {
    switch (currentScreen) {
      case 'drive-setup':
        return (
          <DriveSetupScreen
            isGapiLoaded={isGapiLoaded}
            googleAuth={googleAuth}
            driveFolders={driveFolders}
            handleGoogleSignIn={handleGoogleSignIn}
            handleMainFolderSelect={handleMainFolderSelect}
            mainSessionsFolder={mainSessionsFolder}
            handleSignOut={handleSignOut}
            isConnecting={isConnecting || isRestoringAuth}
            isRestoringAuth={isRestoringAuth}
          />
        );
      case 'folder-selection':
        return (
          <FolderSelectionScreen
            googleAuth={googleAuth}
            selectedMainFolder={selectedMainFolder}
            clientFolders={clientFolders}
            handleClientFolderSelect={handleClientFolderSelect}
            mainSessionsFolder={mainSessionsFolder}
            onSignOut={handleSignOut}
            onChangeMainFolder={handleChangeMainFolder}
            selectedPackage={selectedPackage}
            setSelectedPackage={setSelectedPackage}
            handleContinue={handlePackageContinue} // Skip package screen, go directly to template/photos
            onManageTemplates={() => setCurrentScreen('manual-template-manager')}
            onManagePackages={() => setCurrentScreen('manual-package-manager')}
          />
        );
      case 'package':
        // Package selection is now handled within FolderSelectionScreen
        // This should not be reached anymore, but if it is, redirect to photos
        console.log('Package screen reached - this should not happen. Redirecting to photos.');
        setCurrentScreen('photos');
        return null;
      case 'template-setup':
        return (
          <TemplateSetupScreen
            onComplete={() => setCurrentScreen('folder-selection')}
            onBack={() => setCurrentScreen('folder-selection')}
          />
        );
      case 'photos':
        return (
          <PhotoSelectionScreen
            clientName={clientName}
            selectedPackage={selectedPackage}
            googleAuth={googleAuth}
            templateSlots={templateSlots}
            selectedSlot={selectedSlot}
            setSelectedSlot={setSelectedSlot}
            photos={localPhotos}
            getTotalTemplateCount={getTotalTemplateCount}
            handlePhotoContinue={handlePhotoContinue}
            handlePhotoSelect={handlePhotoSelect}
            handleSlotSelect={handleSlotSelect}
            handleBack={handleBack}
            totalAllowedPrints={getTotalAllowedPrints()}
            setTemplateSlots={setTemplateSlots}
          />
        );
      case 'png-template-management':
        return (
          <PngTemplateManagementScreen
            googleAuth={googleAuth}
            mainSessionsFolder={mainSessionsFolder}
            onSignOut={handleSignOut}
            onChangeMainFolder={handleChangeMainFolder}
            onBack={() => setCurrentScreen('folder-selection')}
            onChangeTemplateFolder={() => setCurrentScreen('template-folder-selection')}
            onManualTemplateManager={() => setCurrentScreen('manual-template-manager')}
            refreshTrigger={templateRefreshTrigger}
          />
        );
      case 'manual-package-manager':
        return (
          <ManualPackageManagerScreen
            googleAuth={googleAuth}
            mainSessionsFolder={mainSessionsFolder}
            onSignOut={handleSignOut}
            onChangeMainFolder={handleChangeMainFolder}
            onBack={() => setCurrentScreen('folder-selection')}
          />
        );
      case 'template-folder-selection':
        return (
          <TemplateFolderSelectionScreen
            googleAuth={googleAuth}
            mainSessionsFolder={mainSessionsFolder}
            onSignOut={handleSignOut}
            onChangeMainFolder={handleChangeMainFolder}
            onBack={() => setCurrentScreen('folder-selection')}
            onFolderSelected={() => {
              setTemplateRefreshTrigger(prev => prev + 1); // Trigger refresh
              setCurrentScreen('png-template-management');
            }}
          />
        );
      case 'manual-template-manager':
        return (
          <ManualTemplateManagerScreen
            googleAuth={googleAuth}
            mainSessionsFolder={mainSessionsFolder}
            onSignOut={handleSignOut}
            onChangeMainFolder={handleChangeMainFolder}
            onBack={() => setCurrentScreen('folder-selection')}
          />
        );
      case 'manual-package-manager':
        return (
          <ManualPackageManagerScreen
            googleAuth={googleAuth}
            mainSessionsFolder={mainSessionsFolder}
            onSignOut={handleSignOut}
            onChangeMainFolder={handleChangeMainFolder}
            onBack={() => setCurrentScreen('manual-template-manager')}
          />
        );
      default:
        return <div>Unknown Screen</div>;
    }
  };

  return (
    <div>
      {/* DEV-DEBUG-OVERLAY: Screen identifier - REMOVE BEFORE PRODUCTION */}
      <div className="fixed bottom-2 right-2 z-50 bg-blue-600 text-white px-2 py-1 text-xs font-mono rounded shadow-lg pointer-events-none">
        index.tsx ({currentScreen})
      </div>
      
      {renderScreen()}

      {/* Existing Prints Dialog */}
      <Transition appear show={showExistingPrintsDialog} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowExistingPrintsDialog(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" />
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900 text-center"
                  >
                    Prints Already Created
                  </Dialog.Title>
                  
                  <div className="mt-4">
                    <div className="text-center">
                      <div className="text-5xl mb-4">📁</div>
                      <p className="text-sm text-gray-600 mb-4">
                        A prints folder already exists with files inside for this client.
                      </p>
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800 font-medium">
                          Please contact Pronoia staff for assistance with existing prints.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <button
                      type="button"
                      className="w-full inline-flex justify-center rounded-lg border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      onClick={() => setShowExistingPrintsDialog(false)}
                    >
                      Understood
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Upload Progress Modal */}
      <Transition appear show={isUploading} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => {}}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" />
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900 text-center mb-4"
                  >
                    Uploading Templates
                  </Dialog.Title>
                  
                  <div className="mt-2">
                    {uploadProgress && (
                      <>
                        <div className="mb-4">
                          <div className="flex justify-between text-sm text-gray-600 mb-2">
                            <span>Processing: {uploadProgress.templateName}</span>
                            <span>{uploadProgress.current + 1} / {uploadProgress.total}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div 
                              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                              style={{ width: `${((uploadProgress.current + 0.5) / uploadProgress.total) * 100}%` }}
                            />
                          </div>
                        </div>
                        
                        <div className="text-center">
                          <div className="inline-flex items-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="text-sm text-gray-600">Rasterizing and uploading...</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="mt-6 text-center text-xs text-gray-500">
                    Please wait while your templates are being uploaded to Google Drive.
                    <br />
                    Do not close this window.
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}

