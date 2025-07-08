// Updated: Latest version with template modals and tablet optimization..
import React, { useState, useEffect } from 'react';
import useAppStore from '../stores/useAppStore';
import { DriveFolder, TemplateSlot, Photo, TemplateTypeInfo, Package } from '../types';
import DriveSetupScreen from '../components/screens/DriveSetupScreen';
import FolderSelectionScreen from '../components/screens/FolderSelectionScreen';
import PackageSelectionScreen from '../components/screens/PackageSelectionScreen';
import TemplateSelectionScreen from '../components/screens/TemplateSelectionScreen';
import PhotoSelectionScreen from '../components/screens/PhotoSelectionScreen';
import googleDriveService from '../services/googleDriveService';

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

export default function Home() {
  const {
    currentScreen,
    googleAuth,
    isGapiLoaded,
    mainSessionsFolder,
    selectedPackage,
    clientName,
    templateCounts,
    templateTypes,
    templateSlots,
    selectedSlot,
    packages,
    eventLog,
    setCurrentScreen,
    setGoogleAuth,
    setIsGapiLoaded,
    setMainSessionsFolder,
    setSelectedPackage,
    setClientName,
    setTemplateSlots,
    setSelectedSlot,
    setPhotos,
    addEvent,
    handleTemplateCountChange,
    getTotalTemplateCount,
  } = useAppStore();

  const [driveFolders, setDriveFolders] = useState<DriveFolder[]>([]);
  const [clientFolders, setClientFolders] = useState<DriveFolder[]>([]);
  const [selectedMainFolder, setSelectedMainFolder] = useState<DriveFolder | null>(null);
  const [selectedClientFolder, setSelectedClientFolder] = useState<DriveFolder | null>(null);
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [localPhotos, setLocalPhotos] = useState<Photo[]>([]);
  const [isRestoringAuth, setIsRestoringAuth] = useState(false);

  // Load main folder from localStorage on initial render
  useEffect(() => {
    const savedFolder = localStorage.getItem('mainSessionsFolder');
    const savedToken = localStorage.getItem('google_access_token');
    const tokenExpiry = localStorage.getItem('google_token_expiry');
    
    if (savedFolder) {
      setMainSessionsFolder(JSON.parse(savedFolder));
      
      // If we have both a saved folder and valid token, set screen to folder-selection immediately
      if (savedToken && tokenExpiry) {
        const expiryTime = parseInt(tokenExpiry);
        const currentTime = Date.now();
        
        // Check if token is still valid (with 5 minute buffer)
        if (currentTime < expiryTime - 300000) {
          setCurrentScreen('folder-selection');
        }
      }
    }
  }, [setMainSessionsFolder, setCurrentScreen]);

  // Function to validate and restore token
  const restoreAuthFromStorage = async () => {
    const storedToken = localStorage.getItem('google_access_token');
    const storedEmail = localStorage.getItem('google_user_email');
    const tokenExpiry = localStorage.getItem('google_token_expiry');
    
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
                const response = await window.gapi.client.drive.files.list({
                  q: `'${folderData.id}' in parents and mimeType='application/vnd.google-apps.folder'`,
                  fields: 'files(id, name, createdTime)',
                  orderBy: 'name'
                });
                setClientFolders(response.result.files || []);
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
        // Token expired, clear it
        addEvent('Stored token expired, clearing');
        clearStoredAuth();
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
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scope)}` +
      `&response_type=token` +
      `&state=${encodeURIComponent(state)}` +
      `&prompt=consent&access_type=online`;
    
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
    setSelectedClientFolder(folder);
    setClientName(folder.name);
    try {
      console.log(`Loading photos from folder: ${folder.name} (${folder.id})`);
      
      // Use our Google Drive service instead of raw API
      const drivePhotos = await googleDriveService.getPhotosFromFolder(folder.id);
      console.log(`Loaded ${drivePhotos.length} photos:`, drivePhotos);
      
      setLocalPhotos(drivePhotos);
      setPhotos(drivePhotos);
      setCurrentScreen('package');
    } catch (error) {
      console.error('Failed to load photos:', error);
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

  const showDebugInfo = () => {
    alert(eventLog.join('\n'));
  };

  // Dummy functions for props
  const handleDemoMode = () => {};
  const handleDemoFolderSelect = () => {};

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
    } else if (currentScreen === 'template') {
      setCurrentScreen('package');
    } else if (currentScreen === 'photos') {
      setCurrentScreen('template');
      setTemplateSlots([]);
      setSelectedSlot(null);
    }
  };

  const handlePackageContinue = () => {
    if (selectedPackage && clientName.trim()) {
      setCurrentScreen('template');
    }
  };

  const handleTemplateContinue = () => {
    const totalCount = getTotalTemplateCount();
    if (totalCount > 0) {
      const slots: TemplateSlot[] = [];
      
      // Create slots based on template counts
      Object.entries(templateCounts).forEach(([templateId, count]) => {
        if ((count as number) > 0) {
          const template = templateTypes.find((t: TemplateTypeInfo) => t.id === templateId);
          if (template) {
            for (let templateIndex = 0; templateIndex < (count as number); templateIndex++) {
              for (let slotIndex = 0; slotIndex < template.slots; slotIndex++) {
                slots.push({
                  id: `${templateId}_${templateIndex}_${slotIndex}`,
                  templateId: `${templateId}_${templateIndex}`,
                  templateName: `${template.name} ${templateIndex + 1}`,
                  templateType: template.id,
                  slotIndex,
                  photoId: undefined
                });
              }
            }
          }
        }
      });
      
      setTemplateSlots(slots);
      setCurrentScreen('photos');
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

  // Template Visual Component
  const TemplateVisual = ({ template, slots, onSlotClick, photos }: {
    template: { id: string, name: string, slots: number },
    slots: TemplateSlot[],
    onSlotClick: (slot: TemplateSlot) => void,
    photos: Photo[]
  }) => {
    const getPhotoUrl = (photoId?: string | null) => {
      if (!photoId) return null;
      return photos.find(p => p.id === photoId)?.url || null;
    };

    // 4R print format (4x6 inches) - width:height ratio of 2:3 (or 4:6)
    const printAspectRatio = '2/3'; // CSS aspect-ratio for 4x6 print

    if (template.id === 'solo') {
      // Solo Template - Single large photo with border for 4R print
      return (
        <div className="bg-white p-3 rounded-lg shadow-md w-full" style={{ aspectRatio: printAspectRatio }}>
          <div 
            className={`w-full h-full border-2 border-dashed border-gray-300 rounded cursor-pointer transition-all duration-200 ${
              selectedSlot === slots[0] ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-400'
            }`}
            onClick={() => onSlotClick(slots[0])}
            style={{ 
              backgroundImage: getPhotoUrl(slots[0]?.photoId) ? `url(${getPhotoUrl(slots[0]?.photoId)})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {!getPhotoUrl(slots[0]?.photoId) && (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <div className="text-2xl mb-1">📷</div>
                  <div className="text-xs">Click to add photo</div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (template.id === 'collage') {
      // Collage Template - 2x2 grid with borders and gaps
      return (
        <div className="bg-white p-3 rounded-lg shadow-md w-full" style={{ aspectRatio: printAspectRatio }}>
          <div className="grid grid-cols-2 gap-2 h-full">
            {slots.slice(0, 4).map((slot, index) => (
              <div
                key={index}
                className={`border-2 border-dashed border-gray-300 rounded cursor-pointer transition-all duration-200 ${
                  selectedSlot === slot ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-400'
                }`}
                onClick={() => onSlotClick(slot)}
                style={{ 
                  backgroundImage: getPhotoUrl(slot?.photoId) ? `url(${getPhotoUrl(slot?.photoId)})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                {!getPhotoUrl(slot?.photoId) && (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <div className="text-xs">📷</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (template.id === 'photocard') {
      // Photocard Template - 2x2 grid like collage but NO borders/gaps (edge-to-edge)
      return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden w-full" style={{ aspectRatio: printAspectRatio }}>
          <div className="grid grid-cols-2 gap-0 h-full">
            {slots.slice(0, 4).map((slot, index) => (
              <div
                key={index}
                className={`cursor-pointer transition-all duration-200 ${
                  selectedSlot === slot ? 'ring-2 ring-blue-500 ring-inset' : ''
                }`}
                onClick={() => onSlotClick(slot)}
                style={{ 
                  backgroundImage: getPhotoUrl(slot?.photoId) ? `url(${getPhotoUrl(slot?.photoId)})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                {!getPhotoUrl(slot?.photoId) && (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100">
                    <div className="text-xs">📷</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (template.id === 'photostrip') {
      // Photo Strip Template - 3 rows of 2 photos each (6 total) like collage but 3 rows
      return (
        <div className="bg-white p-3 rounded-lg shadow-md w-full" style={{ aspectRatio: printAspectRatio }}>
          <div className="grid grid-rows-3 gap-1 h-full">
            {[0, 1, 2].map((row) => (
              <div key={row} className="grid grid-cols-2 gap-1 h-full">
                {slots.slice(row * 2, row * 2 + 2).map((slot, index) => (
                  <div
                    key={index}
                    className={`border-2 border-dashed border-gray-300 rounded cursor-pointer transition-all duration-200 ${
                      selectedSlot === slot ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-400'
                    }`}
                    onClick={() => onSlotClick(slot)}
                    style={{ 
                      backgroundImage: getPhotoUrl(slot?.photoId) ? `url(${getPhotoUrl(slot?.photoId)})` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  >
                    {!getPhotoUrl(slot?.photoId) && (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <div className="text-xs">📷</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'drive-setup':
        return (
          <DriveSetupScreen
            isGapiLoaded={isGapiLoaded}
            googleAuth={googleAuth}
            driveFolders={driveFolders}
            handleGoogleSignIn={handleGoogleSignIn}
            handleDemoMode={handleDemoMode}
            handleMainFolderSelect={handleMainFolderSelect}
            handleDemoFolderSelect={handleDemoFolderSelect}
            showDebugInfo={showDebugInfo}
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
            handleDemoClientSelect={handleDemoFolderSelect}
            handleClientFolderSelect={handleClientFolderSelect}
            mainSessionsFolder={mainSessionsFolder}
            onSignOut={handleSignOut}
            onChangeMainFolder={handleChangeMainFolder}
          />
        );
      case 'package':
        return (
          <PackageSelectionScreen
            clientName={clientName}
            selectedClientFolder={selectedClientFolder}
            photos={localPhotos}
            packages={packages}
            selectedPackage={selectedPackage}
            setSelectedPackage={setSelectedPackage}
            handleBack={handleBack}
            handlePackageContinue={handlePackageContinue}
          />
        );
      case 'template':
        return (
          <TemplateSelectionScreen
            selectedPackage={selectedPackage}
            clientName={clientName}
            googleAuth={googleAuth}
            templateTypes={templateTypes}
            templateCounts={templateCounts}
            getTotalTemplateCount={getTotalTemplateCount}
            handleTemplateCountChange={handleTemplateCountChange}
            handleBack={handleBack}
            handleTemplateContinue={handleTemplateContinue}
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
            photos={localPhotos}
            getTotalTemplateCount={getTotalTemplateCount}
            handlePhotoContinue={() => alert('Photo selection complete!')}
            handlePhotoSelect={handlePhotoSelect}
            handleSlotSelect={handleSlotSelect}
            TemplateVisual={TemplateVisual}
          />
        );
      default:
        return <div>Unknown Screen</div>;
    }
  };

  return <div>{renderScreen()}</div>;
}
