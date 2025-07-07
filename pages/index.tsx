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
    driveFolders,
    selectedMainFolder,
    clientFolders,
    selectedClientFolder,
    photos,
    selectedPackage,
    clientName,
    templateSlots,
    selectedSlot,
    templateCounts,
    packages,
    templateTypes,
    setCurrentScreen,
    setGoogleAuth,
    setIsGapiLoaded,
    setDriveFolders,
    setSelectedMainFolder,
    setClientFolders,
    setSelectedClientFolder,
    setPhotos,
    setSelectedPackage,
    setClientName,
    setTemplateSlots,
    setSelectedSlot,
    setTemplateCounts,
    handleTemplateCountChange,
    getTotalTemplateCount,
    mainSessionsFolder,
    setMainSessionsFolder,
    addEvent,
  } = useAppStore();
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [tokenClient, setTokenClient] = useState<any>(null);

    const [viewingTemplate, setViewingTemplate] = useState<{
    template: TemplateTypeInfo;
    slots: TemplateSlot[];
    templateIndex: number;
  } | null>(null);

  useEffect(() => {
    addEvent('App component mounted');
    const savedFolder = localStorage.getItem('mainSessionsFolder');
    if (savedFolder) {
      addEvent('Found saved main folder in localStorage');
      setMainSessionsFolder(JSON.parse(savedFolder));
    }
  }, []);

  // Load Google API
  useEffect(() => {
    addEvent('useEffect for Google API loading triggered');
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

    console.log('🔍 Environment Check:', {
      hasClientId: !!clientId,
      hasApiKey: !!apiKey,
      clientIdLength: clientId?.length || 0,
      apiKeyLength: apiKey?.length || 0,
      clientIdPreview: clientId?.substring(0, 20) + '...',
      apiKeyPreview: apiKey?.substring(0, 15) + '...',
      isDefaultValue: clientId === 'your_google_client_id_here',
      clientIdFormat: clientId?.includes('.apps.googleusercontent.com') ? 'Valid ✅' : 'Invalid ❌',
      apiKeyFormat: apiKey?.startsWith('AIza') ? 'Valid ✅' : 'Invalid ❌'
    });
      
      if (!clientId || !apiKey || clientId === 'your_google_client_id_here') {
      console.log('⚠️ Google API credentials not configured - running in demo mode');
      addEvent('Google API credentials not configured, running in demo mode');
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
      // Initialize the Sign-In client
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredentialResponse, // This will handle the sign-in
        auto_select: false,
        cancel_on_tap_outside: false,
      });
      addEvent('Google Accounts ID initialized');

      // Initialize the OAuth Token Client
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive',
        callback: (tokenResponse: any) => {
          addEvent('OAuth token response received');
          console.log('🎯 Full token response:', tokenResponse);
          
          if (tokenResponse.error) {
            console.error('❌ OAuth error in token response:', tokenResponse.error);
            addEvent(`OAuth error in token response: ${tokenResponse.error}`);
            
            let errorMessage = 'Failed to get Drive permissions. ';
            if (tokenResponse.error === 'popup_closed_by_user') {
              errorMessage += 'Permission popup was closed. Please try again and complete the permission flow.';
            } else if (tokenResponse.error === 'popup_blocked_by_browser') {
              errorMessage += 'Permission popup was blocked by your browser. Please disable popup blockers for this site and try again.';
            } else if (tokenResponse.error === 'access_denied') {
              errorMessage += 'You denied access to Google Drive. Please try again and grant the necessary permissions.';
            } else {
              errorMessage += `Error: ${tokenResponse.error}. Please try again.`;
            }
            
            alert(errorMessage);
            return;
          }
          
          if (tokenResponse.access_token) {
            console.log('✅ OAuth2 token received, loading folders...');
            addEvent('OAuth2 token received, loading folders');
            window.gapi.client.setToken({ access_token: tokenResponse.access_token });
            // Also set token in GoogleDriveService if it exists
            if (typeof window !== 'undefined' && (window as any).googleDriveService) {
              (window as any).googleDriveService.setAccessToken(tokenResponse.access_token);
              addEvent('Access token set in googleDriveService');
            }
            // Reset requesting permissions state if it exists
            const driveSetupElement = document.querySelector('[data-requesting-permissions="true"]');
            if (driveSetupElement) {
              driveSetupElement.setAttribute('data-requesting-permissions', 'false');
            }
            loadDriveFolders();
          } else {
            addEvent('OAuth2 token response did not contain access_token');
            console.error('❌ No access token in response:', tokenResponse);
            alert('Failed to get Drive permissions. No access token received. Please try again.');
          }
        },
        error_callback: (error: any) => {
          addEvent(`OAuth error callback: ${JSON.stringify(error)}`);
          console.error('❌ OAuth error callback:', error);
          
          let errorMessage = 'Failed to get Drive permissions. ';
          if (error.type === 'popup_failed_to_open') {
            errorMessage += 'Unable to open permission popup. Please check your popup blocker settings and try again.';
          } else if (error.type === 'popup_closed') {
            errorMessage += 'Permission popup was closed before completing. Please try again and complete the permission flow.';
          } else {
            errorMessage += `Error: ${error.type || 'Unknown error'}. Please check your popup blocker and try again.`;
          }
          
          alert(errorMessage);
        }
      });
      setTokenClient(client);
      console.log('✅ Google Identity Services initialized');
      addEvent('Google Identity Services initialized');
    };
    document.head.appendChild(gsiScript);
  }, []);

  const handleDemoMode = () => {
    addEvent('Demo mode activated');
    console.log('Demo mode activated!');
    
    // Create mock folders for demo
    const mockMainFolders: DriveFolder[] = [
      { id: 'demo1', name: 'Photo Sessions 2024', createdTime: '2024-01-01T00:00:00.000Z' },
      { id: 'demo2', name: 'Wedding Photos', createdTime: '2024-02-01T00:00:00.000Z' },
      { id: 'demo3', name: 'Portrait Sessions', createdTime: '2024-03-01T00:00:00.000Z' },
    ];
    
    // Set demo state
    setDriveFolders(mockMainFolders);
    setGoogleAuth({ isSignedIn: true, userEmail: 'demo@example.com' });
    setIsGapiLoaded(true);
    
    console.log('Demo mode setup complete - should see folder grid now');
  };

  const handleDemoFolderSelect = (folder: DriveFolder) => {
    setSelectedMainFolder(folder);
    
    // Create mock client folders
    const mockClientFolders: DriveFolder[] = [
      { id: 'client1', name: 'John_Smith_Wedding', createdTime: '2024-01-15T00:00:00.000Z' },
      { id: 'client2', name: 'Sarah_Johnson_Portrait', createdTime: '2024-01-20T00:00:00.000Z' },
      { id: 'client3', name: 'Mike_Davis_Family', createdTime: '2024-01-25T00:00:00.000Z' },
      { id: 'client4', name: 'Lisa_Brown_Graduation', createdTime: '2024-02-01T00:00:00.000Z' },
    ];
    
    setClientFolders(mockClientFolders);
    setCurrentScreen('folder-selection');
  };

  const handleDemoClientSelect = (folder: DriveFolder) => {
    setSelectedClientFolder(folder);
    setClientName(folder.name.replace(/_/g, ' '));
    
    // Sample Shutterstock photo URLs - replace these with your actual Shutterstock links
    const samplePhotoUrls = [
      'https://www.shutterstock.com/shutterstock/photos/2584803111/display_1500/stock-photo-a-beautiful-young-woman-poses-gracefully-highlighting-her-stunning-earrings-in-soft-light-2584803111.jpg', // Replace with your Shutterstock URL
      'https://www.shutterstock.com/shutterstock/photos/2520106327/display_1500/stock-photo-studio-portrait-and-asian-man-with-chopstick-for-eating-nutrition-and-laughing-with-confidence-2520106327.jpg', // Replace with your Shutterstock URL
      'https://www.shutterstock.com/shutterstock/photos/2352115081/display_1500/stock-photo-fitness-sports-and-portrait-of-women-in-studio-for-yoga-training-and-exercise-on-pink-background-2352115081.jpg', // Replace with your Shutterstock URL
      'https://www.shutterstock.com/shutterstock/photos/2600955651/display_1500/stock-photo-cheerful-sisters-sharing-loving-moment-in-professional-studio-with-white-isolated-background-2600955651.jpg', // Replace with your Shutterstock URL
      'https://www.shutterstock.com/shutterstock/photos/2516150727/display_1500/stock-photo-man-glasses-and-beanie-for-style-in-studio-portrait-with-color-mock-up-and-space-by-background-2516150727.jpg', // Replace with your Shutterstock URL
      'https://www.shutterstock.com/shutterstock/photos/2564533355/display_1500/stock-photo-a-young-couple-joyfully-embraces-in-a-studio-radiating-romance-and-style-for-valentines-day-2564533355.jpg', // Replace with your Shutterstock URL
      'https://www.shutterstock.com/shutterstock/photos/2564533355/display_1500/stock-photo-a-young-couple-joyfully-embraces-in-a-studio-radiating-romance-and-style-for-valentines-day-2564533355.jpg', // Replace with your Shutterstock URL
      'https://www.shutterstock.com/shutterstock/photos/2564533355/display_1500/stock-photo-a-young-couple-joyfully-embraces-in-a-studio-radiating-romance-and-style-for-valentines-day-2564533355.jpg', // Replace with your Shutterstock URL
      'https://image.shutterstock.com/image-photo/sample-19.jpg', // Replace with your Shutterstock URL
      'https://image.shutterstock.com/image-photo/sample-20.jpg' // Replace with your Shutterstock URL
    ];
    
    // Create mock photos from the sample URLs
    const mockPhotos: Photo[] = samplePhotoUrls.map((url, i) => ({
      id: `demo_${i + 1}`,
      url: url,
      name: `Photo_${i + 1}.jpg`,
      thumbnailUrl: url,
      mimeType: 'image/jpeg',
      size: 1000,
      googleDriveId: `demo_${i + 1}`,
      webContentLink: url,
      webViewLink: url,
      createdTime: new Date().toISOString(),
      modifiedTime: new Date().toISOString(),
    }));
    
    setPhotos(mockPhotos);
    setCurrentScreen('package');
  };

  const handleGoogleCredentialResponse = (response: any) => {
    addEvent('Processing Google credential response');
    console.log('🔑 Processing Google credential response...');
    try {
      // Decode the JWT to get user info
      const credential = response.credential;
      const base64Url = credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));

      const userInfo = JSON.parse(jsonPayload);
      console.log('✅ User info extracted:', userInfo);
      addEvent(`User info extracted for ${userInfo.email}`);
      
      setGoogleAuth({
        isSignedIn: true,
        userEmail: userInfo.email
      });

      // Add a small delay to ensure state updates are processed
      setTimeout(() => {
        if (tokenClient) {
          console.log('🔐 Requesting Drive API permissions...');
          addEvent('Requesting Drive API permissions');
          // Force the consent prompt to always show
          tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
          console.error('❌ Token client not initialized');
          addEvent('Token client not initialized');
        }
      }, 100);

    } catch (error) {
      console.error('❌ Failed to process credential response:', error);
      addEvent(`Failed to process credential response: ${error}`);
    }
  };

  const handleGoogleSignIn = () => {
    addEvent('Starting Google sign-in process');
    console.log('🔐 Starting Google sign-in process...');
    
    if (window.google && window.google.accounts) {
      // Trigger the sign-in popup
      console.log('✅ Prompting for Google sign-in...');
      addEvent('Prompting for Google sign-in');
      window.google.accounts.id.prompt((notification: any) => {
        console.log('📍 Prompt notification:', notification);
        addEvent(`Google sign-in prompt notification: ${JSON.stringify(notification)}`);
      });
      } else {
      console.error('❌ Google Sign-In is not ready');
      addEvent('Google Sign-In is not ready');
      alert('Google Sign-In is not ready. Please refresh the page and try again.');
    }
  };

  const requestDrivePermissions = () => {
    addEvent('Manually requesting Drive permissions');
    console.log('🔐 Manually requesting Drive permissions...');
    console.log('🔍 Token client state:', {
      exists: !!tokenClient,
      type: typeof tokenClient,
      hasRequestAccessToken: tokenClient && typeof tokenClient.requestAccessToken === 'function'
    });
    
    if (tokenClient) {
      try {
        console.log('🚀 Calling requestAccessToken...');
        addEvent('Calling requestAccessToken with consent prompt');
        tokenClient.requestAccessToken({ prompt: 'consent' });
        console.log('✅ requestAccessToken called successfully');
      } catch (error) {
        console.error('❌ Error calling requestAccessToken:', error);
        addEvent(`Error calling requestAccessToken: ${error}`);
        alert(`Error requesting permissions: ${error}`);
      }
    } else {
      console.error('❌ Token client not initialized');
      addEvent('Token client not initialized - cannot request permissions');
      alert('Unable to request permissions. Please refresh the page and try again.');
    }
  };

  // Make the function globally available
  useEffect(() => {
    (window as any).requestDrivePermissions = requestDrivePermissions;
    return () => {
      delete (window as any).requestDrivePermissions;
    };
  }, [tokenClient]);

  const loadDriveFolders = async () => {
    addEvent('Loading Google Drive folders');
    try {
      console.log('📁 Loading Google Drive folders...');
      
      const response = await window.gapi.client.drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder'",
        fields: 'files(id, name, createdTime)',
        orderBy: 'name'
      });
      
      console.log('✅ Drive API response:', response);
      console.log('📂 Found folders:', response.result.files?.length || 0);
      addEvent(`Found ${response.result.files?.length || 0} folders`);
      
      setDriveFolders(response.result.files || []);
    } catch (error: any) {
      console.error('❌ Failed to load folders:', error);
      addEvent(`Failed to load folders: ${error.message}`);
      console.error('🔍 Error details:', {
        status: error.status,
        statusText: error.statusText,
        message: error.message,
        details: error.body ? JSON.parse(error.body) : 'No additional details'
      });
      
      // More specific error message
      let errorMessage = 'Failed to load Google Drive folders.';
      if (error.status === 403) {
        errorMessage = 'Permission denied. Please check that Google Drive API is enabled and you have the correct permissions.';
      } else if (error.status === 401) {
        errorMessage = 'Authentication expired. Please refresh the page and sign in again.';
      }
      
      alert(errorMessage);
    }
  };

  const handleMainFolderSelect = async (folder: DriveFolder) => {
    addEvent(`Main folder selected: ${folder.name}`);
    setSelectedMainFolder(folder);
    
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
      
      setPhotos(drivePhotos);
      setCurrentScreen('package');
    } catch (error) {
      console.error('Failed to load photos:', error);
      alert('Failed to load photos from the selected folder.');
    }
  };

  const createPrintOutputFolder = async (clientFolderId: string, folderName: string) => {
    try {
      console.log('📁 Creating print output folder:', folderName);
      
      const fileMetadata = {
        name: folderName,
        parents: [clientFolderId],
        mimeType: 'application/vnd.google-apps.folder'
      };

      const response = await window.gapi.client.drive.files.create({
        resource: fileMetadata,
        fields: 'id, name'
      });

      console.log('✅ Print output folder created:', response.result);
      return response.result;
    } catch (error: any) {
      console.error('❌ Failed to create print output folder:', error);
      throw new Error(`Failed to create folder: ${error.message}`);
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
      let slotCounter = 0;
      
      // Create slots based on template counts
      Object.entries(templateCounts).forEach(([templateId, count]) => {
        if (count > 0) {
          const template = templateTypes.find(t => t.id === templateId);
          if (template) {
            for (let templateIndex = 0; templateIndex < count; templateIndex++) {
              for (let slotIndex = 0; slotIndex < template.slots; slotIndex++) {
                slots.push({
                  id: `${templateId}_${templateIndex}_${slotIndex}`,
                  templateId: `${templateId}_${templateIndex}`,
                  templateName: `${template.name} ${templateIndex + 1}`,
                  templateType: template.id,
                  slotIndex,
                  photoId: undefined
                });
                slotCounter++;
              }
            }
          }
        }
      });
      
      setTemplateSlots(slots);
      setCurrentScreen('photos');
    }
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
    } else if (currentScreen === 'template') {
      setCurrentScreen('package');
    } else if (currentScreen === 'photos') {
      setCurrentScreen('template');
      setTemplateSlots([]);
      setSelectedSlot(null);
    }
  };

  const handleSlotSelect = (slot: TemplateSlot) => {
    setSelectedSlot(slot);
  };

  const handlePhotoSelect = (photo: Photo) => {
    if (selectedSlot) {
      setTemplateSlots(
        templateSlots.map(slot =>
          slot === selectedSlot
            ? { ...slot, photoId: photo.id }
            : slot
        )
      );
      const currentSlotIndex = templateSlots.findIndex(s => s === selectedSlot);
      const nextEmptySlot = templateSlots.slice(currentSlotIndex + 1).find(s => !s.photoId);
      setSelectedSlot(nextEmptySlot || null);
    }
  };

  const handlePhotoContinue = async () => {
    const filledSlots = templateSlots.filter(slot => slot.photoId).length;
    
    if (filledSlots < templateSlots.length) {
      const shouldContinue = confirm(`You have ${filledSlots}/${templateSlots.length} slots filled. Some slots are empty. Continue anyway?`);
      if (!shouldContinue) return;
    }

    if (googleAuth.userEmail === 'demo@example.com') {
      alert(`Demo Mode: Photo selection complete! ${filledSlots}/${templateSlots.length} slots filled. In real mode, prints would be generated and saved to Google Drive.`);
      return;
    }

    try {
      // Create print output folder
      const outputFolderName = `${clientName}_Prints_${new Date().toISOString().split('T')[0]}`;
      console.log('📁 Creating print output folder for:', clientName);
      
      if (selectedClientFolder) {
        const printFolder = await createPrintOutputFolder(selectedClientFolder.id, outputFolderName);
        
        // Here you would generate the actual print templates and upload them
        // For now, we'll just show a success message
        alert(`✅ Print output folder created: "${outputFolderName}"\n\nNext steps:\n1. Generate print templates\n2. Upload prints to the folder\n3. Notify client`);
        
        console.log('🎯 Print workflow ready:', {
          clientName,
          outputFolder: printFolder,
          filledSlots,
          totalSlots: templateSlots.length,
          selectedPackage: selectedPackage?.name
        });
      }
    } catch (error: any) {
      console.error('❌ Failed to create print output folder:', error);
      alert(`Failed to create print output folder: ${error.message}`);
    }
  };

  const showDebugInfo = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    const currentDomain = window.location.origin;
    
    const info = {
      // Environment Variables
      environment: {
        hasClientId: !!clientId,
        hasApiKey: !!apiKey,
        clientIdLength: clientId?.length || 0,
        apiKeyLength: apiKey?.length || 0,
        clientIdFormat: clientId?.includes('.apps.googleusercontent.com') ? 'Valid ✅' : 'Invalid ❌',
        apiKeyFormat: apiKey?.startsWith('AIza') ? 'Valid ✅' : 'Invalid ❌',
        clientIdPreview: clientId?.substring(0, 30) + '...',
        apiKeyPreview: apiKey?.substring(0, 20) + '...'
      },
      
      // Domain Configuration
      domain: {
        currentOrigin: currentDomain,
        isLocalhost: currentDomain.includes('localhost'),
        isVercel: currentDomain.includes('vercel.app'),
        isDevelopment: process.env.NODE_ENV === 'development',
        authorizedDomains: [
          'http://localhost:3000',
          'http://localhost:3001', 
          'https://pronoia-app.vercel.app'
        ],
        domainNote: 'Make sure this current origin is added to Authorized JavaScript origins in Google Cloud Console'
      },
      
      // Google API Status
      googleAPI: {
      gapiLoaded: !!window.gapi,
      auth2Loaded: !!(window.gapi && window.gapi.auth2),
      authInstance: !!(window.gapi && window.gapi.auth2 && window.gapi.auth2.getAuthInstance()),
        driveAPIAvailable: !!(window.gapi && window.gapi.client && window.gapi.client.drive),
        isGapiLoaded: isGapiLoaded,
        tokenClientExists: !!tokenClient,
        googleIdentityServicesLoaded: !!(window.google && window.google.accounts && window.google.accounts.oauth2)
      },
      
      // Authentication Status
      authentication: {
        isSignedIn: googleAuth.isSignedIn,
        userEmail: googleAuth.userEmail,
        hasGoogleIdentityServices: !!(window.google && window.google.accounts),
        driveFoldersCount: driveFolders.length
      },
      
      // Current URL
      currentURL: window.location.href,
      
      // Event Log
      eventLog: useAppStore().eventLog.join('\n'),
      
      // Troubleshooting Tips
      tips: [
        '1. Make sure Google Drive API is enabled in Google Cloud Console',
        '2. Check that your domain is in authorized origins',
        '3. Verify API Key and Client ID formats are correct',
        '4. Try refreshing the page if APIs are not loaded',
        '5. Make sure you complete the permission popup flow',
        '6. Check browser console for specific error messages',
        '7. Try in incognito mode to rule out extensions'
      ]
    };
    
    setDebugInfo(JSON.stringify(info, null, 2));
    console.log('=== COMPREHENSIVE GOOGLE API DEBUG INFO ===', info);
  };

  const handleSignOut = () => {
    addEvent('Signing out');
    if (googleAuth.userEmail) {
      googleDriveService.signOut();
      window.google.accounts.id.revoke(googleAuth.userEmail, () => {
        console.log('Consent revoked.');
        addEvent('Consent revoked');
        setGoogleAuth({ isSignedIn: false, userEmail: null });
        setDriveFolders([]);
        setSelectedMainFolder(null);
        setClientFolders([]);
        setSelectedClientFolder(null);
        setPhotos([]);
        setSelectedPackage(null);
        setClientName('');
        setTemplateSlots([]);
        setSelectedSlot(null);
        setCurrentScreen('drive-setup');
        localStorage.removeItem('mainSessionsFolder');
        setMainSessionsFolder(null);
        console.log('App state reset.');
        addEvent('App state reset');
      });
    }
  };

  // Template Visual Components
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

    if (template.id === 'solo') {
      // Solo Template - Single large photo with border
      return (
        <div className="bg-white p-3 rounded-lg shadow-md w-full h-full">
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
      // Collage Template - 2x2 grid
      return (
        <div className="bg-white p-3 rounded-lg shadow-md w-full h-full">
          <div className="grid grid-cols-2 gap-1 h-full">
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
      // Photocard Template - 2x2 grid like collage but no borders/padding
      return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden w-full h-full">
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
      // Photo Strip Template - 3 rows of 2 photos each (6 total)
      return (
        <div className="bg-white p-3 rounded-lg shadow-md w-full h-full">
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
            debugInfo={debugInfo}
            setDebugInfo={setDebugInfo}
            mainSessionsFolder={mainSessionsFolder}
            handleSignOut={handleSignOut}
          />
        );
      case 'folder-selection':
        return (
          <FolderSelectionScreen
            googleAuth={googleAuth}
            selectedMainFolder={selectedMainFolder}
            clientFolders={clientFolders}
            handleDemoClientSelect={handleDemoClientSelect}
            handleClientFolderSelect={handleClientFolderSelect}
            handleBack={handleBack}
          />
        );
      case 'package':
        return (
          <PackageSelectionScreen
            clientName={clientName}
            selectedClientFolder={selectedClientFolder}
            photos={photos}
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
            photos={photos}
            getTotalTemplateCount={getTotalTemplateCount}
            handlePhotoContinue={handlePhotoContinue}
            TemplateVisual={TemplateVisual}
          />
        );
      default:
        return null;
    }
  };

  return <div>{renderScreen()}</div>;
}
