// Updated: Latest version with template modals and tablet optimization..
import { useState, useEffect } from 'react';
import useAppStore from '../stores/useAppStore';
import DriveSetupScreen from '../components/screens/DriveSetupScreen';
import FolderSelectionScreen from '../components/screens/FolderSelectionScreen';
import PackageSelectionScreen from '../components/screens/PackageSelectionScreen';
import TemplateSelectionScreen from '../components/screens/TemplateSelectionScreen';
import PhotoSelectionScreen from '../components/screens/PhotoSelectionScreen';
import { Package, TemplateTypeInfo, Photo, TemplateSlot, DriveFolder, GoogleAuth, Screen } from '../types';
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
  } = useAppStore();

  const [driveFolders, setDriveFolders] = useState<DriveFolder[]>([]);
  const [clientFolders, setClientFolders] = useState<DriveFolder[]>([]);
  const [selectedMainFolder, setSelectedMainFolder] = useState<DriveFolder | null>(null);
  const [selectedClientFolder, setSelectedClientFolder] = useState<DriveFolder | null>(null);
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [localPhotos, setLocalPhotos] = useState<Photo[]>([]);

  // Load main folder from localStorage on initial render
  useEffect(() => {
    const savedFolder = localStorage.getItem('mainSessionsFolder');
    if (savedFolder) {
      setMainSessionsFolder(JSON.parse(savedFolder));
    }
  }, [setMainSessionsFolder]);

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
    } catch (error: any) {
      console.error('❌ Failed to load folders:', error);
      let errorMessage = 'Failed to load Google Drive folders.';
      if (error.status === 403) errorMessage = 'Permission denied.';
      else if (error.status === 401) errorMessage = 'Authentication expired.';
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
          if ((window as any).googleDriveService) {
              (window as any).googleDriveService.setAccessToken(accessToken);
          }
          sessionStorage.removeItem('oauth_state');
          setGoogleAuth({ isSignedIn: true, userEmail: 'Authenticated' });
          loadDriveFolders();
        } else {
          setIsConnecting(false);
        }
      }
    };
    
    if (isGapiLoaded) {
      handleOAuthRedirect();
    }
  }, [isGapiLoaded, addEvent, setGoogleAuth]);

  const handleMainFolderSelect = async (folder: DriveFolder) => {
    setSelectedMainFolder(folder);
    setMainSessionsFolder({ id: folder.id, name: folder.name });
    try {
      const response = await window.gapi.client.drive.files.list({
        q: `'${folder.id}' in parents and mimeType='application/vnd.google-apps.folder'`,
        fields: 'files(id, name, createdTime)',
        orderBy: 'name'
      });
      setClientFolders(response.result.files || []);
      setCurrentScreen('folder-selection');
    } catch (error) {
      alert('Failed to load client folders.');
    }
  };

  const handleClientFolderSelect = async (folder: DriveFolder) => {
    setSelectedClientFolder(folder);
    setClientName(folder.name);
    try {
      const response = await window.gapi.client.drive.files.list({
        q: `'${folder.id}' in parents and (mimeType contains 'image/')`,
        fields: 'files(id, name, thumbnailLink, webViewLink)',
        orderBy: 'name'
      });
      const drivePhotos = response.result.files?.map((file: any) => ({
        id: file.id,
        url: file.thumbnailLink?.replace('=s220', '=s800') || file.webViewLink,
        name: file.name,
        thumbnailUrl: file.thumbnailLink,
        mimeType: 'image/jpeg',
        size: 1000,
        googleDriveId: file.id,
        webContentLink: file.webViewLink,
        webViewLink: file.webViewLink,
        createdTime: new Date().toISOString(),
        modifiedTime: new Date().toISOString(),
      })) || [];
      setLocalPhotos(drivePhotos);
      setPhotos(drivePhotos);
      setCurrentScreen('package');
    } catch (error) {
      alert('Failed to load photos.');
    }
  };

  const handleSignOut = () => {
    addEvent('Signing out');
    if (googleAuth.userEmail) {
      googleDriveService.signOut();
      setGoogleAuth({ isSignedIn: false, userEmail: null });
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
      setCurrentScreen('drive-setup');
      localStorage.removeItem('mainSessionsFolder');
      setMainSessionsFolder(null);
    }
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
            isConnecting={isConnecting}
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
            handleBack={() => setCurrentScreen('drive-setup')}
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
            getTotalTemplateCount={() => Object.values(templateCounts).reduce((sum, count) => sum + count, 0)}
            handleTemplateCountChange={() => {}}
            handleBack={handleBack}
            handleTemplateContinue={() => setCurrentScreen('photos')}
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
            getTotalTemplateCount={() => Object.values(templateCounts).reduce((sum, count) => sum + count, 0)}
            handlePhotoContinue={() => alert('Photo selection complete!')}
            TemplateVisual={() => <div>Template Visual</div>}
          />
        );
      default:
        return <div>Unknown Screen</div>;
    }
  };

  return <div>{renderScreen()}</div>;
}
