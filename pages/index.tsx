// Updated: Latest version with template modals and tablet optimization..
import { useState, useEffect } from 'react';

interface Package {
  id: string;
  name: string;
  templateCount: number;
  price: number;
  description: string;
}

interface TemplateType {
  id: string;
  name: string;
  description: string;
  icon: string;
  preview: string;
  slots: number; // Number of photo slots for this template type
}

interface Photo {
  id: string;
  url: string;
  name: string;
}

interface TemplateSlot {
  templateId: string;
  templateName: string;
  slotIndex: number;
  photoId: string | null;
}

interface DriveFolder {
  id: string;
  name: string;
  createdTime: string;
}

interface GoogleAuth {
  isSignedIn: boolean;
  userEmail: string | null;
}

const packages: Package[] = [
  { 
    id: 'A', 
    name: 'Package A', 
    templateCount: 1, 
    price: 249,
    description: 'Perfect for a single memorable print'
  },
  { 
    id: 'B', 
    name: 'Package B', 
    templateCount: 2, 
    price: 549,
    description: 'Great for couples or small groups'
  },
  { 
    id: 'C', 
    name: 'Package C', 
    templateCount: 5, 
    price: 999,
    description: 'Ideal for families and events'
  },
  { 
    id: 'D', 
    name: 'Package D', 
    templateCount: 10, 
    price: 1999,
    description: 'Complete collection for special occasions'
  },
];

const templateTypes: TemplateType[] = [
  {
    id: 'solo',
    name: 'Solo Print',
    description: 'Single photo with white border',
    icon: '🖼️',
    preview: 'One large photo with elegant white border',
    slots: 1
  },
  {
    id: 'collage',
    name: 'Collage Print',
    description: '4 photos in 2x2 grid layout',
    icon: '🏁',
    preview: 'Four photos arranged in a perfect grid',
    slots: 4
  },
  {
    id: 'photocard',
    name: 'Photocard Print',
    description: '4 photos edge-to-edge, no borders',
    icon: '🎴',
    preview: 'Four photos seamlessly connected without borders',
    slots: 4
  },
  {
    id: 'photostrip',
    name: 'Photo Strip Print',
    description: '6 photos in 3 rows of 2',
    icon: '📸',
    preview: 'Six photos arranged in three horizontal rows',
    slots: 6
  }
];

type Screen = 'drive-setup' | 'folder-selection' | 'package' | 'template' | 'photos';

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
  const [currentScreen, setCurrentScreen] = useState<Screen>('drive-setup');
  const [googleAuth, setGoogleAuth] = useState<GoogleAuth>({ isSignedIn: false, userEmail: null });
  const [isGapiLoaded, setIsGapiLoaded] = useState(false);
  const [driveFolders, setDriveFolders] = useState<DriveFolder[]>([]);
  const [selectedMainFolder, setSelectedMainFolder] = useState<DriveFolder | null>(null);
  const [clientFolders, setClientFolders] = useState<DriveFolder[]>([]);
  const [selectedClientFolder, setSelectedClientFolder] = useState<DriveFolder | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [clientName, setClientName] = useState('');
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [templateCounts, setTemplateCounts] = useState<Record<string, number>>({
    solo: 0,
    collage: 0,
    photocard: 0,
    photostrip: 0
  });
  const [templateSlots, setTemplateSlots] = useState<TemplateSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TemplateSlot | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [viewingTemplate, setViewingTemplate] = useState<{
    template: TemplateType;
    slots: TemplateSlot[];
    templateIndex: number;
  } | null>(null);

  // Load Google API
  useEffect(() => {
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
      setIsGapiLoaded(true);
      return;
    }

    // Load GAPI for Drive API calls
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.onload = () => {
      window.gapi.load('client', async () => {
        await window.gapi.client.init({
          apiKey: apiKey,
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        setIsGapiLoaded(true);
        console.log('✅ GAPI client initialized');
      });
    };
    document.head.appendChild(gapiScript);

    // Load GIS for Sign-In and OAuth
    const gsiScript = document.createElement('script');
    gsiScript.src = 'https://accounts.google.com/gsi/client';
    gsiScript.async = true;
    gsiScript.defer = true;
    gsiScript.onload = () => {
      // Initialize the Sign-In client
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredentialResponse, // This will handle the sign-in
      });

      // Initialize the OAuth Token Client
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive',
        callback: (tokenResponse: any) => {
          if (tokenResponse.access_token) {
            console.log('✅ OAuth2 token received, loading folders...');
            window.gapi.client.setToken({ access_token: tokenResponse.access_token });
            loadDriveFolders();
          }
        },
      });
      setTokenClient(client);
      console.log('✅ Google Identity Services initialized');
    };
    document.head.appendChild(gsiScript);
  }, []);

  const handleDemoMode = () => {
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
      'https://www.shutterstock.com/shutterstock/photos/2564533355/display_1500/stock-photo-a-young-couple-joyfully-embraces-in-a-studio-radiating-romance-and-style-for-valentines-day-2564533355.jpg', // Replace with your Shutterstock URL
      'https://www.shutterstock.com/shutterstock/photos/2564533355/display_1500/stock-photo-a-young-couple-joyfully-embraces-in-a-studio-radiating-romance-and-style-for-valentines-day-2564533355.jpg', // Replace with your Shutterstock URL
      'https://www.shutterstock.com/shutterstock/photos/2564533355/display_1500/stock-photo-a-young-couple-joyfully-embraces-in-a-studio-radiating-romance-and-style-for-valentines-day-2564533355.jpg', // Replace with your Shutterstock URL
      'https://www.shutterstock.com/shutterstock/photos/2564533355/display_1500/stock-photo-a-young-couple-joyfully-embraces-in-a-studio-radiating-romance-and-style-for-valentines-day-2564533355.jpg', // Replace with your Shutterstock URL
      'https://www.shutterstock.com/shutterstock/photos/2564533355/display_1500/stock-photo-a-young-couple-joyfully-embraces-in-a-studio-radiating-romance-and-style-for-valentines-day-2564533355.jpg', // Replace with your Shutterstock URL
      'https://www.shutterstock.com/shutterstock/photos/2564533355/display_1500/stock-photo-a-young-couple-joyfully-embraces-in-a-studio-radiating-romance-and-style-for-valentines-day-2564533355.jpg', // Replace with your Shutterstock URL
      'https://www.shutterstock.com/shutterstock/photos/2564533355/display_1500/stock-photo-a-young-couple-joyfully-embraces-in-a-studio-radiating-romance-and-style-for-valentines-day-2564533355.jpg', // Replace with your Shutterstock URL
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
      name: `Photo_${i + 1}.jpg`
    }));
    
    setPhotos(mockPhotos);
    setCurrentScreen('package');
  };

  const handleGoogleCredentialResponse = (response: any) => {
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

      setGoogleAuth({
        isSignedIn: true,
        userEmail: userInfo.email
      });

      // ---- THIS IS THE CRITICAL CHANGE ----
      // Now that the user is signed in, request the Drive API token.
      // This will trigger the permission pop-up if needed.
      if (tokenClient) {
        console.log('🔐 Requesting Drive API permissions...');
        tokenClient.requestAccessToken();
      } else {
        console.error('❌ Token client not initialized');
      }

    } catch (error) {
      console.error('❌ Failed to process credential response:', error);
    }
  };

  const handleGoogleSignIn = () => {
    console.log('🔐 Starting Google sign-in process...');
    
    if (window.google && window.google.accounts) {
      // This will display the "Sign in with Google" pop-up
      console.log('✅ Prompting for Google sign-in...');
      window.google.accounts.id.prompt();
    } else {
      console.error('❌ Google Sign-In is not ready');
      alert('Google Sign-In is not ready. Please refresh the page and try again.');
    }
  };

  const loadDriveFolders = async () => {
    try {
      console.log('📁 Loading Google Drive folders...');
      
      const response = await window.gapi.client.drive.files.list({
        q: "mimeType='application/vnd.google-apps.folder'",
        fields: 'files(id, name, createdTime)',
        orderBy: 'name'
      });
      
      console.log('✅ Drive API response:', response);
      console.log('📂 Found folders:', response.result.files?.length || 0);
      
      setDriveFolders(response.result.files || []);
    } catch (error: any) {
      console.error('❌ Failed to load folders:', error);
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
        name: file.name
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

  const uploadFileToFolder = async (folderId: string, fileName: string, fileBlob: Blob, mimeType: string) => {
    try {
      console.log('📤 Uploading file to folder:', fileName);
      
      const metadata = {
        name: fileName,
        parents: [folderId]
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
      form.append('file', fileBlob);

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: new Headers({
          'Authorization': `Bearer ${window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token}`
        }),
        body: form
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ File uploaded successfully:', result);
      return result;
    } catch (error: any) {
      console.error('❌ Failed to upload file:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  };

  const handlePackageContinue = () => {
    if (selectedPackage && clientName.trim()) {
      setCurrentScreen('template');
    }
  };

  const handleTemplateToggle = (templateId: string) => {
    if (selectedTemplates.includes(templateId)) {
      setSelectedTemplates(selectedTemplates.filter(id => id !== templateId));
    } else if (selectedTemplates.length < (selectedPackage?.templateCount || 0)) {
      setSelectedTemplates([...selectedTemplates, templateId]);
    } else {
      const newSelection = [...selectedTemplates];
      newSelection[newSelection.length - 1] = templateId;
      setSelectedTemplates(newSelection);
    }
  };

  const handleTemplateCountChange = (templateId: string, change: number) => {
    const currentCount = templateCounts[templateId] || 0;
    const newCount = Math.max(0, currentCount + change);
    
    // Calculate total templates
    const totalCount = Object.values(templateCounts).reduce((sum, count) => sum + count, 0) - currentCount + newCount;
    
    // Don't exceed package limit
    if (totalCount <= (selectedPackage?.templateCount || 0)) {
      setTemplateCounts(prev => ({
        ...prev,
        [templateId]: newCount
      }));
    }
  };

  const getTotalTemplateCount = () => {
    return Object.values(templateCounts).reduce((sum, count) => sum + count, 0);
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
                  templateId: `${templateId}_${templateIndex}`,
                  templateName: `${template.name} ${templateIndex + 1}`,
                  slotIndex,
                  photoId: null
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
      setSelectedTemplates([]);
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
      setTemplateSlots(slots => 
        slots.map(slot => 
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
      
      // Google API Status
      googleAPI: {
        gapiLoaded: !!window.gapi,
        auth2Loaded: !!(window.gapi && window.gapi.auth2),
        authInstance: !!(window.gapi && window.gapi.auth2 && window.gapi.auth2.getAuthInstance()),
        driveAPIAvailable: !!(window.gapi && window.gapi.client && window.gapi.client.drive),
        isGapiLoaded: isGapiLoaded
      },
      
      // Authentication Status
      authentication: {
        isSignedIn: googleAuth.isSignedIn,
        userEmail: googleAuth.userEmail,
        hasGoogleIdentityServices: !!(window.google && window.google.accounts)
      },
      
      // Current URL
      currentURL: window.location.href,
      
      // Troubleshooting Tips
      tips: [
        '1. Make sure Google Drive API is enabled in Google Cloud Console',
        '2. Check that your domain is in authorized origins',
        '3. Verify API Key and Client ID formats are correct',
        '4. Try refreshing the page if APIs are not loaded'
      ]
    };
    
    setDebugInfo(JSON.stringify(info, null, 2));
    console.log('=== COMPREHENSIVE GOOGLE API DEBUG INFO ===', info);
  };

  // Template Visual Components
  const TemplateVisual = ({ template, slots, onSlotClick, photos }: {
    template: { id: string, name: string, slots: number },
    slots: TemplateSlot[],
    onSlotClick: (slot: TemplateSlot) => void,
    photos: Photo[]
  }) => {
    const getPhotoUrl = (photoId: string | null) => {
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

  // Google Drive Setup Screen
  if (currentScreen === 'drive-setup') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">
              Pronoia Photo Studio
            </h1>
            <p className="text-gray-600 text-lg mb-8">
              Connect to Google Drive to access your photo sessions
            </p>
          </div>

          {!isGapiLoaded ? (
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading Google Drive...</p>
            </div>
          ) : !googleAuth.isSignedIn ? (
            <div className="space-y-6">
              {/* Google Sign In */}
              <div className="bg-white rounded-lg p-8 shadow-sm text-center">
                <div className="mb-6">
                  <div className="text-6xl mb-4">📁</div>
                  <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                    Connect Google Drive
                  </h2>
                  <p className="text-gray-600">
                    Sign in to access your photo folders and client sessions
                  </p>
                </div>
                                  <button
                    onClick={handleGoogleSignIn}
                    className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium text-lg hover:bg-blue-700 transition-all duration-200 shadow-md"
                  >
                    Sign in with Google
                  </button>
                  <div className="mt-4">
                    <button
                      onClick={showDebugInfo}
                      className="bg-gray-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-600 transition-all duration-200"
                    >
                      🔍 Debug Info
                    </button>
                  </div>
              </div>

              {/* Demo Mode Option */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <div className="text-center">
                  <div className="text-4xl mb-4">🎭</div>
                  <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                    Demo Mode
                  </h2>
                  <p className="text-gray-600 mb-4">
                    Try the app with sample photos and folders
                  </p>
                  <button
                    onClick={handleDemoMode}
                    className="bg-yellow-600 text-white px-8 py-3 rounded-lg font-medium text-lg hover:bg-yellow-700 transition-all duration-200 shadow-md"
                  >
                    Try Demo Mode
                  </button>
                </div>
              </div>

              {/* Debug Info Display */}
              {debugInfo && (
                <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 mt-6">
                  <h4 className="text-lg font-semibold text-gray-800 mb-2">🔍 Debug Information</h4>
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
                    {debugInfo}
                  </pre>
                  <button
                    onClick={() => setDebugInfo('')}
                    className="mt-2 bg-red-500 text-white px-3 py-1 rounded text-xs hover:bg-red-600"
                  >
                    Close Debug
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg p-8 shadow-sm">
              <div className="text-center mb-6">
                <div className="text-4xl mb-4">✅</div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                  Connected to Google Drive
                </h2>
                <p className="text-gray-600">
                  Signed in as: <span className="font-medium">{googleAuth.userEmail}</span>
                </p>
              </div>

              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  Select Main Photo Folder
                </h3>
                <p className="text-gray-600 mb-4">
                  Choose the main folder that contains all your client photo sessions
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                  {driveFolders.map((folder) => (
                    <div
                      key={folder.id}
                      onClick={() => googleAuth.userEmail === 'demo@example.com' ? handleDemoFolderSelect(folder) : handleMainFolderSelect(folder)}
                      className="bg-gray-50 rounded-lg p-4 cursor-pointer hover:bg-blue-50 hover:border-blue-300 border-2 border-transparent transition-all duration-200"
                    >
                      <div className="flex items-center">
                        <div className="text-2xl mr-3">📁</div>
                        <div>
                          <p className="font-medium text-gray-800">{folder.name}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(folder.createdTime).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Folder Selection Screen
  if (currentScreen === 'folder-selection') {
    const isDemoMode = googleAuth.userEmail === 'demo@example.com';
    
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Select Client Folder
            </h1>
            <p className="text-gray-600 text-lg">
              Choose the client's photo session folder
            </p>
            <div className="mt-2 text-sm text-blue-600">
              Main folder: {selectedMainFolder?.name}
              {isDemoMode && <span className="ml-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">DEMO MODE</span>}
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {clientFolders.map((folder) => (
                <div
                  key={folder.id}
                  onClick={() => isDemoMode ? handleDemoClientSelect(folder) : handleClientFolderSelect(folder)}
                  className="bg-gray-50 rounded-lg p-4 cursor-pointer hover:bg-blue-50 hover:border-blue-300 border-2 border-transparent transition-all duration-200"
                >
                  <div className="flex items-center">
                    <div className="text-2xl mr-3">👥</div>
                    <div>
                      <p className="font-medium text-gray-800">{folder.name}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(folder.createdTime).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {clientFolders.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No client folders found in this directory
              </div>
            )}
          </div>

          <div className="text-center mt-6">
            <button
              onClick={handleBack}
              className="px-6 py-3 rounded-lg font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition-all duration-200"
            >
              ← Back to Main Folders
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Rest of the screens remain the same but using real photos from Google Drive
  if (currentScreen === 'package') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Package Selection
            </h1>
            <p className="text-gray-600 text-lg">
              Select your photo package for {clientName}
            </p>
            <div className="mt-2 text-sm text-blue-600">
              📁 {selectedClientFolder?.name} • {photos.length} photos available
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                onClick={() => setSelectedPackage(pkg)}
                className={`bg-white rounded-lg p-6 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md ${
                  selectedPackage?.id === pkg.id
                    ? 'ring-2 ring-blue-500 bg-blue-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {pkg.id}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    {pkg.name}
                  </h3>
                  <div className="text-2xl font-bold text-gray-900 mb-2">
                    ₱{pkg.price}
                  </div>
                  <div className="text-lg text-blue-600 font-medium mb-3">
                    {pkg.templateCount} {pkg.templateCount === 1 ? 'Print' : 'Prints'}
                  </div>
                  <p className="text-sm text-gray-600">
                    {pkg.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between">
            <button
              onClick={handleBack}
              className="px-6 py-3 rounded-lg font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition-all duration-200"
            >
              ← Back to Folders
            </button>
            <button
              onClick={handlePackageContinue}
              disabled={!selectedPackage}
              className={`px-8 py-3 rounded-lg font-medium text-lg transition-all duration-200 ${
                selectedPackage
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Continue to Print Selection
            </button>
          </div>

          {selectedPackage && (
            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Selected: <span className="font-medium text-gray-800">{selectedPackage.name}</span> 
                {' '}• {selectedPackage.templateCount} print(s) • ₱{selectedPackage.price}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (currentScreen === 'template') {
    // Print Selection Screen
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Print Selection
            </h1>
            <p className="text-gray-600 text-lg">
              Choose up to {selectedPackage?.templateCount} print types for {clientName}
            </p>
            <div className="mt-2 text-sm text-blue-600">
              {selectedPackage?.name} • ₱{selectedPackage?.price}
              {googleAuth.userEmail === 'demo@example.com' && <span className="ml-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">DEMO MODE</span>}
            </div>
          </div>

          {/* Progress Info */}
          <div className="bg-white rounded-lg p-4 mb-6 shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">
                Prints Selected: {getTotalTemplateCount()} / {selectedPackage?.templateCount}
              </span>
              <div className="w-48 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(getTotalTemplateCount() / (selectedPackage?.templateCount || 1)) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Print Types */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {templateTypes.map((template) => {
              const count = templateCounts[template.id] || 0;
              const totalCount = getTotalTemplateCount();
              const canIncrease = totalCount < (selectedPackage?.templateCount || 0);
              
              return (
                <div
                  key={template.id}
                  className={`bg-white rounded-lg p-6 transition-all duration-200 shadow-sm ${
                    count > 0
                      ? 'ring-2 ring-green-500 bg-green-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-4xl mb-3">
                      {template.icon}
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">
                      {template.name}
                    </h3>
                    <p className="text-gray-600 mb-3">
                      {template.description}
                    </p>
                    <p className="text-sm text-gray-500 italic mb-4">
                      {template.preview}
                    </p>
                    
                    {/* Counter Controls */}
                    <div className="flex items-center justify-center space-x-4">
                      <button
                        onClick={() => handleTemplateCountChange(template.id, -1)}
                        disabled={count === 0}
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold transition-all duration-200 ${
                          count === 0
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-red-500 text-white hover:bg-red-600 active:scale-95'
                        }`}
                      >
                        −
                      </button>
                      
                      <div className="min-w-[60px] text-center">
                        <div className="text-2xl font-bold text-gray-800">{count}</div>
                        <div className="text-xs text-gray-500">prints</div>
                      </div>
                      
                      <button
                        onClick={() => handleTemplateCountChange(template.id, 1)}
                        disabled={!canIncrease}
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold transition-all duration-200 ${
                          !canIncrease
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-green-500 text-white hover:bg-green-600 active:scale-95'
                        }`}
                      >
                        +
                      </button>
                    </div>
                    
                    {count > 0 && (
                      <div className="mt-3 text-green-600 font-medium">
                        ✓ {count} selected
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <button
              onClick={handleBack}
              className="px-6 py-3 rounded-lg font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition-all duration-200"
            >
              ← Back to Packages
            </button>
            <button
              onClick={handleTemplateContinue}
              disabled={getTotalTemplateCount() === 0}
              className={`px-8 py-3 rounded-lg font-medium text-lg transition-all duration-200 ${
                getTotalTemplateCount() > 0
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Continue to Photo Selection
            </button>
          </div>

          {/* Selected Prints Info */}
          {getTotalTemplateCount() > 0 && (
            <div className="mt-6 text-center">
              <p className="text-gray-600 mb-2">
                <span className="font-medium text-gray-800">Selected Prints Summary:</span>
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                {Object.entries(templateCounts).map(([templateId, count]) => {
                  if (count > 0) {
                    const template = templateTypes.find(t => t.id === templateId);
                    return (
                      <div key={templateId} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                        {template?.name}: {count}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Photo Selection Screen
  if (currentScreen === 'photos') {
    return (
      <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
        {/* Header - Fixed at top */}
        <div className="bg-white shadow-sm p-4 flex-shrink-0">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-1">
              Photo Selection
            </h1>
            <p className="text-gray-600">
              Assign photos to your print slots for {clientName}
            </p>
            <div className="mt-1 text-sm text-blue-600">
              {selectedPackage?.name} • {getTotalTemplateCount()} print(s)
              {googleAuth.userEmail === 'demo@example.com' && <span className="ml-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">DEMO MODE</span>}
            </div>
            {selectedSlot && (
              <div className="mt-2 text-sm text-white bg-blue-600 px-4 py-2 rounded-full inline-block">
                📍 Selecting for: {selectedSlot.templateName} - Slot {selectedSlot.slotIndex + 1}
              </div>
            )}
          </div>
        </div>

        {/* Photo Grid - Scrollable content area */}
        <div className="flex-1 overflow-y-auto p-4">
          {!selectedSlot && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-yellow-800 text-center font-medium">
                👇 Select a print slot below to start choosing photos
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 pb-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => handlePhotoSelect(photo)}
                className={`relative cursor-pointer rounded-lg overflow-hidden transition-all duration-200 ${
                  selectedSlot 
                    ? 'hover:ring-4 hover:ring-blue-500 hover:scale-105 shadow-lg' 
                    : 'opacity-50 cursor-not-allowed grayscale'
                }`}
                style={{ aspectRatio: '2/3' }}
              >
                <img
                  src={photo.url}
                  alt={photo.name}
                  className="w-full h-full object-cover"
                />
                {selectedSlot && (
                  <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                    <div className="bg-white bg-opacity-95 rounded-full px-3 py-2 opacity-0 hover:opacity-100 transition-opacity duration-200 shadow-lg">
                      <span className="text-blue-600 font-bold text-sm">SELECT</span>
                    </div>
                  </div>
                )}
                {/* Show if photo is already used */}
                {templateSlots.some(slot => slot.photoId === photo.id) && (
                  <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                    ✓
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Print Section - Fixed at bottom with proper height */}
        <div className="bg-white border-t-2 border-gray-200 flex-shrink-0" style={{ height: '320px' }}>
          <div className="h-full flex flex-col p-4">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-800">Your Prints</h3>
              <div className="text-sm text-gray-600">
                {templateSlots.filter(slot => slot.photoId).length} / {templateSlots.length} slots filled
              </div>
            </div>
            
            {/* Horizontal Scrollable Prints with proper sizing */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
              <div className="flex space-x-6 h-full items-start" style={{ width: 'max-content', minHeight: '240px' }}>
                {Object.entries(templateCounts).map(([templateId, count]) => {
                  if (count === 0) return null;
                  
                  const template = templateTypes.find(t => t.id === templateId);
                  if (!template) return null;

                  return Array.from({ length: count }, (_, index) => {
                    const currentTemplateSlots = templateSlots.filter(slot => 
                      slot.templateId === `${templateId}_${index}`
                    );
                    
                    return (
                      <div key={`${templateId}_${index}`} className="flex-shrink-0">
                        <div className="bg-gray-50 p-4 rounded-lg shadow-sm border-2 border-transparent hover:border-blue-300 transition-all duration-200" style={{ width: '200px', height: '260px' }}>
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="text-sm font-medium text-gray-700 truncate flex-1">
                              {template.name} {index + 1}
                            </h4>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingTemplate({
                                  template,
                                  slots: currentTemplateSlots,
                                  templateIndex: index
                                });
                              }}
                              className="ml-2 bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600 transition-all duration-200"
                            >
                              View
                            </button>
                          </div>
                          <div className="flex justify-center">
                            <div style={{ width: '160px', height: '210px' }}>
                              <TemplateVisual
                                template={template}
                                slots={currentTemplateSlots}
                                onSlotClick={handleSlotSelect}
                                photos={photos}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation - Fixed at very bottom */}
        <div className="bg-white border-t border-gray-200 p-4 flex justify-between items-center flex-shrink-0">
          <button
            onClick={handleBack}
            className="px-6 py-3 rounded-lg font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all duration-200"
          >
            ← Back
          </button>
          <button
            onClick={handlePhotoContinue}
            className="px-8 py-3 rounded-lg font-medium text-lg bg-blue-600 text-white hover:bg-blue-700 shadow-md transition-all duration-200"
          >
            Continue to Preview →
          </button>
        </div>

        {/* Template View Modal */}
        {viewingTemplate && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-full overflow-hidden">
              {/* Modal Header */}
              <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800">
                  {viewingTemplate.template.name} {viewingTemplate.templateIndex + 1}
                </h2>
                <button
                  onClick={() => setViewingTemplate(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-all duration-200"
                >
                  ×
                </button>
              </div>
              
              {/* Modal Content */}
              <div className="p-8 flex justify-center items-center" style={{ minHeight: '500px' }}>
                <div className="w-full max-w-md">
                  <TemplateVisual
                    template={viewingTemplate.template}
                    slots={viewingTemplate.slots}
                    onSlotClick={handleSlotSelect}
                    photos={photos}
                  />
                </div>
              </div>
              
              {/* Modal Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  {viewingTemplate.slots.filter(slot => slot.photoId).length} / {viewingTemplate.slots.length} slots filled
                </div>
                <button
                  onClick={() => setViewingTemplate(null)}
                  className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition-all duration-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return <div>Loading...</div>;
} 