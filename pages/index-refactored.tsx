import React, { useState, useEffect } from 'react';
import useAuthStore from '../stores/authStore';
import useDriveStore from '../stores/driveStore';
import useSessionStore from '../stores/sessionStore';
import useTemplateStore from '../stores/templateStore';
import useUIStore from '../stores/uiStore';
import { DriveFolder, TemplateSlot, Photo, TemplateType } from '../types';
import DriveSetupScreen from '../components/screens/DriveSetupScreen';
import FolderSelectionScreen from '../components/screens/FolderSelectionScreen';
import PackageSelectionScreen from '../components/screens/PackageSelectionScreen';
import TemplateSelectionScreen from '../components/screens/TemplateSelectionScreen';
import PhotoSelectionScreen from '../components/screens/PhotoSelectionScreen';
import TemplateVisual from '../components/TemplateVisual';
import ErrorBoundary from '../components/ErrorBoundary';
import googleDriveService from '../services/googleDriveService';
// Removed unused import

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
  // Store hooks
  const { googleAuth, isGapiLoaded, setGoogleAuth, setIsGapiLoaded, clearAuth } = useAuthStore();
  const {
    currentScreen,
    driveFolders,
    selectedMainFolder,
    clientFolders,
    selectedClientFolder,
    mainSessionsFolder,
    photos,
    setCurrentScreen,
    setDriveFolders,
    setSelectedMainFolder,
    setClientFolders,
    setSelectedClientFolder,
    setMainSessionsFolder,
    setPhotos,
    clearDriveData,
  } = useDriveStore();
  const {
    selectedPackage,
    clientName,
    setSelectedPackage,
    setClientName,
    clearSession,
  } = useSessionStore();
  const {
    templateSlots,
    selectedSlot,
    templateCounts,
    templateTypes,
    setTemplateSlots,
    setSelectedSlot,
    handleTemplateCountChange,
    getTotalTemplateCount,
    clearTemplates,
  } = useTemplateStore();
  const { addEvent, setLoading, setError } = useUIStore();

  // Local state
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRestoringAuth, setIsRestoringAuth] = useState(false);
  const [additionalPrints, setAdditionalPrints] = useState(0);
  const [favoritedPhotos, setFavoritedPhotos] = useState<Set<string>>(new Set());

  // Load Google API and handle authentication
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

      console.log('✅ Google Identity Services initialized');
      addEvent('Google Identity Services initialized');
    };
    document.head.appendChild(gsiScript);
  }, [addEvent, setIsGapiLoaded]);

  const restoreAuthFromStorage = async () => {
    const storedToken = localStorage.getItem('google_access_token');
    const storedEmail = localStorage.getItem('google_user_email');
    const tokenExpiry = localStorage.getItem('google_token_expiry');

    if (storedToken && tokenExpiry) {
      const expiryTime = parseInt(tokenExpiry);
      const currentTime = Date.now();

      if (currentTime < expiryTime - 300000) {
        addEvent('Restoring authentication from localStorage');
        setIsRestoringAuth(true);

        try {
          if (window.gapi && window.gapi.client) {
            window.gapi.client.setToken({ access_token: storedToken });
            googleDriveService.setAccessToken(storedToken);
            setGoogleAuth({ isSignedIn: true, userEmail: storedEmail || 'Authenticated' });

            await loadDriveFolders();
            addEvent('Authentication restored successfully');

            const savedFolder = localStorage.getItem('mainSessionsFolder');
            if (savedFolder) {
              const folderData = JSON.parse(savedFolder);
              setSelectedMainFolder({ id: folderData.id, name: folderData.name, createdTime: '' });

              if (currentScreen !== 'folder-selection') {
                setCurrentScreen('folder-selection');
              }

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
        } catch {
          addEvent('Failed to restore authentication, clearing stored token');
          clearStoredAuth();
        } finally {
          setIsRestoringAuth(false);
        }
      }
    }
  };

  const clearStoredAuth = () => {
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_user_email');
    localStorage.removeItem('google_token_expiry');
    clearAuth();
  };

  const handleGoogleSignIn = () => {
    addEvent('Starting Google Sign-In and permission flow');
    requestDrivePermissionsRedirect();
  };

  const requestDrivePermissionsRedirect = () => {
    addEvent('Using redirect-based OAuth flow');
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError('Google Client ID not configured.');
      return;
    }

    setIsConnecting(true);

    // const redirectUri = window.location.origin;
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

  const loadDriveFolders = async () => {
    addEvent('Loading Google Drive folders');
    try {
      setLoading(true, 'Loading Drive folders...');
      const response = await window.gapi.client.drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder' and 'root' in parents",
        fields: 'files(id, name, createdTime)',
        orderBy: 'name'
      });
      setDriveFolders(response.result.files || []);

      try {
        const aboutResponse = await window.gapi.client.drive.about.get({
          fields: 'user(emailAddress)'
        });
        if (aboutResponse.result.user?.emailAddress) {
          const email = aboutResponse.result.user.emailAddress;
          localStorage.setItem('google_user_email', email);
          setGoogleAuth({ isSignedIn: true, userEmail: email });
        }
      } catch {
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
      setError(errorMessage);
    } finally {
      setIsConnecting(false);
      setLoading(false);
    }
  };

  const handleMainFolderSelect = async (folder: DriveFolder) => {
    addEvent(`Main folder selected: ${folder.name}`);
    setSelectedMainFolder(folder);
    setMainSessionsFolder({ id: folder.id, name: folder.name });

    try {
      setLoading(true, 'Loading client folders...');
      const response = await window.gapi.client.drive.files.list({
        q: `'${folder.id}' in parents and mimeType='application/vnd.google-apps.folder'`,
        fields: 'files(id, name, createdTime)',
        orderBy: 'name'
      });
      setClientFolders(response.result.files || []);
      setCurrentScreen('folder-selection');
    } catch (error) {
      console.error('Failed to load client folders:', error);
      setError('Failed to load client folders. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClientFolderSelect = async (folder: DriveFolder) => {
    setSelectedClientFolder(folder);
    setClientName(folder.name);
    try {
      setLoading(true, 'Loading photos...');
      console.log(`Loading photos from folder: ${folder.name} (${folder.id})`);

      const drivePhotos = await googleDriveService.getPhotosFromFolder(folder.id);
      console.log(`Loaded ${drivePhotos.length} photos:`, drivePhotos);

      setPhotos(drivePhotos);
      setCurrentScreen('package');
    } catch (error) {
      console.error('Failed to load photos:', error);
      setError('Failed to load photos from the selected folder.');
    } finally {
      setLoading(false);
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
    setCurrentScreen('drive-setup');

    localStorage.removeItem('mainSessionsFolder');
    setMainSessionsFolder(null);

    clearDriveData();
    clearSession();
    clearTemplates();
    setAdditionalPrints(0);
  };

  const handleBack = () => {
    if (currentScreen === 'folder-selection') {
      setCurrentScreen('drive-setup');
      setSelectedMainFolder(null);
      setClientFolders([]);
    } else if (currentScreen === 'package') {
      setCurrentScreen('folder-selection');
      setSelectedClientFolder(null);
      setPhotos([]);
      setSelectedPackage(null);
      setClientName('');
      setAdditionalPrints(0);
    } else if (currentScreen === 'template') {
      setCurrentScreen('package');
    } else if (currentScreen === 'photos') {
      setCurrentScreen('template');
      setTemplateSlots([]);
      setSelectedSlot(null);
    }
  };

  const getTotalAllowedPrints = () => {
    const basePrints = (selectedPackage as any)?.template_count || (selectedPackage as any)?.templateCount || 0;
    return basePrints + additionalPrints;
  };

  const handleTemplateCountChangeWithAddons = (templateId: string, change: number) => {
    const totalAllowedPrints = getTotalAllowedPrints();
    handleTemplateCountChange(templateId, change, totalAllowedPrints);
  };

  const handleTemplateContinue = () => {
    const totalCount = getTotalTemplateCount();
    if (totalCount > 0) {
      const slots: TemplateSlot[] = [];

      Object.entries(templateCounts).forEach(([templateId, count]) => {
        if ((count as number) > 0) {
          const template = templateTypes.find(t => t.id === templateId);
          if (template) {
            for (let templateIndex = 0; templateIndex < (count as number); templateIndex++) {
              for (let slotIndex = 0; slotIndex < template.slots; slotIndex++) {
                slots.push({
                  id: `${templateId}_${templateIndex}_${slotIndex}`,
                  templateId: `${templateId}_${templateIndex}`,
                  templateName: `${template.name} ${templateIndex + 1}`,
                  templateType: template.id as TemplateType,
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
            onChangeMainFolder={() => setCurrentScreen('drive-setup')}
            selectedPackage={selectedPackage}
            setSelectedPackage={setSelectedPackage}
            handleContinue={() => setCurrentScreen('template')}
            onManageTemplates={() => setCurrentScreen('template-setup')}
          />
        );
      case 'package':
        return (
          <PackageSelectionScreen
            clientName={clientName}
            selectedClientFolder={selectedClientFolder}
            photos={photos}
            packages={[]} // Legacy packages array - now using manual package management
            selectedPackage={selectedPackage}
            setSelectedPackage={(pkg) => setSelectedPackage(pkg)}
            handleBack={handleBack}
            handlePackageContinue={() => setCurrentScreen('template')}
          />
        );
      case 'template':
        return (
          <TemplateSelectionScreen
            selectedPackage={selectedPackage}
            clientName={clientName}
            googleAuth={googleAuth}
            templateCounts={templateCounts}
            getTotalTemplateCount={getTotalTemplateCount}
            handleTemplateCountChange={handleTemplateCountChange}
            handleBack={handleBack}
            handleTemplateContinue={handleTemplateContinue}
            totalAllowedPrints={getTotalAllowedPrints()}
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
            photos={photos}
            getTotalTemplateCount={getTotalTemplateCount}
            handlePhotoContinue={() => setError('Photo selection complete!')}
            handlePhotoSelect={handlePhotoSelect}
            handleSlotSelect={handleSlotSelect}
            totalAllowedPrints={getTotalAllowedPrints()}
            setTemplateSlots={setTemplateSlots}
            favoritedPhotos={favoritedPhotos}
            setFavoritedPhotos={setFavoritedPhotos}
          />
        );
      default:
        return <div>Unknown Screen</div>;
    }
  };

  return (
    <ErrorBoundary onError={(error, errorInfo) => {
      addEvent(`Error boundary caught: ${error instanceof Error ? error.message : String(error)}`);
      console.error('Error boundary caught:', error, errorInfo);
    }}>
      <div>{renderScreen()}</div>
    </ErrorBoundary>
  );
}