# Pronoia Studios PH App

<!-- Updated with latest features -->

Professional photo selection interface for photo studios.

A professional photo studio management application built with React/Next.js that allows clients to select and arrange their photos into professional 4R templates after photoshoots. Optimized for Android tablets with Google Drive integration.

## 🚀 Features

### Core Functionality
- **Package System**: 4 different packages (A=1, B=2, C=5, D=10 templates)
- **Template Types**: Solo, Collage (2x2), Photocard (edge-to-edge), Photo Strip (6 vertical photos)
- **Google Drive Integration**: Read photos and save completed templates
- **Touch-Optimized Interface**: Designed for Android tablets in landscape mode
- **High-Quality Output**: Professional 4R size (1200x1800 pixels at 300 DPI)

### User Workflow
1. Select package and connect Google Drive
2. Choose template types up to package limit
3. Select photos for each template position
4. Preview and export final templates
5. Save to Google Drive with timestamp folders

### Technical Features
- **Canvas-Based Template Generation**: High-quality output with proper scaling
- **State Management**: Zustand for app state with persistence
- **Responsive Design**: Tailwind CSS with tablet optimizations
- **Touch Gestures**: Optimized for touch interactions
- **Session Management**: Save/resume editing sessions
- **Error Handling**: Comprehensive error boundaries and validation

## 📋 Requirements

- Node.js 18.0.0 or higher
- Google Drive API credentials
- Modern web browser with HTML5 Canvas support

## 🛠 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd PronoiaPhotoSelectionApp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Google Drive API**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Google Drive API
   - Create credentials (OAuth 2.0 Client IDs)
   - Add your domain to authorized origins
   - Note down Client ID and API Key

4. **Configure environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
   NEXT_PUBLIC_GOOGLE_API_KEY=your_google_api_key
   ```

5. **Install Tailwind CSS plugins**
   ```bash
   npm install @tailwindcss/forms @tailwindcss/aspect-ratio
   ```

6. **Run the development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🏗 Project Structure

```
PronoiaPhotoSelectionApp/
├── components/              # React components
│   ├── PackageSelection.tsx # Package selection interface
│   ├── TemplateSelection.tsx# Template type selection
│   ├── PhotoSelection.tsx   # Photo selection grid
│   ├── TemplatePreview.tsx  # Template preview and export
│   ├── LoadingOverlay.tsx   # Loading states
│   └── ...
├── pages/                   # Next.js pages
│   ├── _app.tsx            # App configuration
│   └── index.tsx           # Main application page
├── services/               # Service layer
│   ├── googleDriveService.ts# Google Drive integration
│   └── templateGenerationService.ts # Template generation
├── stores/                 # State management
│   └── useAppStore.ts      # Zustand store
├── types/                  # TypeScript types
│   └── index.ts           # Application types
├── utils/                  # Utilities and constants
│   └── constants.ts       # App constants and configurations
├── styles/                 # Styling
│   └── globals.css        # Global styles with Tailwind
└── Sample Output/          # Example output files
    ├── 1 (1).png
    ├── 1 (3).png
    ├── 1 (4).png
    └── 2 (1).png
```

## 📱 Usage

### For Photo Studio Staff

1. **Initial Setup**
   - Connect to Google Drive with studio account
   - Ensure client photos are in organized folders

2. **Client Session**
   - Enter client name
   - Paste Google Drive folder ID/URL containing client photos
   - Select appropriate package based on client needs

3. **Template Creation**
   - Choose template types (Solo, Collage, Photocard, Photo Strip)
   - Select photos for each template position
   - Preview templates before final export

4. **Export and Delivery**
   - Review all templates
   - Export to Google Drive in timestamped folder
   - Share folder with client or print directly

### For Clients (Self-Service Mode)

1. **Package Selection**
   - Choose from available packages
   - View template limits and pricing

2. **Photo Selection**
   - Browse through session photos
   - Tap to select photos for template positions
   - Photos can be used multiple times

3. **Template Customization**
   - Mix and match different template types
   - Rearrange photos within templates
   - Preview final results

4. **Completion**
   - Review all templates
   - Confirm selections
   - Receive notification when ready

## 🎨 Template Specifications

### 4R Size (Standard Photo Size)
- **Dimensions**: 1200 x 1800 pixels
- **Resolution**: 300 DPI
- **Aspect Ratio**: 2:3 (4" x 6")
- **Format**: High-quality JPEG

### Template Types

#### Solo Template
- **Layout**: Single photo with white border
- **Padding**: 60px all sides
- **Best for**: Individual portraits, special moments

#### Collage Template
- **Layout**: 4 photos in 2x2 grid
- **Spacing**: 20px between photos
- **Padding**: 40px outer border
- **Best for**: Family groups, events

#### Photocard Template
- **Layout**: Full bleed, edge-to-edge
- **Padding**: 0px (no borders)
- **Best for**: Landscape photos, artistic shots

#### Photo Strip Template
- **Layout**: 6 photos in vertical strip
- **Spacing**: 15px between photos
- **Padding**: 30px sides
- **Best for**: Photo booth style, sequences

## 🔧 Configuration

### Google Drive Setup

1. **API Configuration**
   ```javascript
   // In utils/constants.ts
   export const GOOGLE_DRIVE_CONFIG = {
     scopes: [
       'https://www.googleapis.com/auth/drive.readonly',
       'https://www.googleapis.com/auth/drive.file',
     ],
     discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
     clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
     apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
   };
   ```

2. **Folder Structure Recommendations**
   ```
   Client Sessions/
   ├── 2024-01-15_ClientName/
   │   ├── RAW_Photos/
   │   └── Output_2024-01-15_143022/
   │       ├── Solo_1.jpg
   │       ├── Collage_1.jpg
   │       └── PhotoStrip_1.jpg
   ```

### Package Customization

```javascript
// In utils/constants.ts
export const PACKAGES = [
  { id: 'A', name: 'Package A', templateCount: 1, price: 50 },
  { id: 'B', name: 'Package B', templateCount: 2, price: 80 },
  { id: 'C', name: 'Package C', templateCount: 5, price: 150 },
  { id: 'D', name: 'Package D', templateCount: 10, price: 250 },
];
```

## 📱 Tablet Optimization

### Touch Interface
- **Minimum Touch Target**: 44px (iOS/Android standard)
- **Touch Feedback**: Visual and haptic feedback
- **Gesture Support**: Tap, swipe, pinch for photo viewing

### Landscape Orientation
- **Optimized Layout**: Horizontal space utilization
- **Navigation**: Tablet-friendly navigation patterns
- **Typography**: Larger fonts for readability

### Performance
- **Image Optimization**: Lazy loading and caching
- **Canvas Rendering**: Hardware-accelerated rendering
- **Memory Management**: Efficient image handling

## 🚀 Deployment

### Replit Deployment

1. **Create Replit Project**
   ```bash
   # Import from GitHub repository
   # Or upload project files
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   - Add environment variables in Replit secrets
   - Set up Google Drive API credentials

4. **Deploy**
   ```bash
   npm run build
   npm start
   ```

### Vercel Deployment

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Deploy**
   ```bash
   vercel --prod
   ```

3. **Environment Variables**
   - Configure in Vercel dashboard
   - Add Google Drive credentials

## 🔒 Security Considerations

### Google Drive Integration
- **OAuth 2.0**: Secure authentication flow
- **Scope Limitation**: Minimal required permissions
- **Token Management**: Automatic refresh handling

### Client Data Protection
- **No Server Storage**: Photos processed client-side only
- **Temporary URLs**: Auto-expiring blob URLs
- **Session Management**: Local storage with encryption

## 🐛 Troubleshooting

### Common Issues

1. **Google Drive Authentication Failed**
   ```
   - Check Client ID and API Key
   - Verify authorized origins in Google Console
   - Ensure Google Drive API is enabled
   ```

2. **Photos Not Loading**
   ```
   - Verify folder permissions
   - Check image file formats (JPEG, PNG, WEBP)
   - Ensure stable internet connection
   ```

3. **Template Generation Failed**
   ```
   - Check browser Canvas support
   - Verify image URLs are accessible
   - Clear browser cache and reload
   ```

4. **Touch Interface Issues**
   ```
   - Disable browser zoom (viewport meta tag)
   - Check for touch event conflicts
   - Test on different devices/browsers
   ```

### Performance Optimization

1. **Image Loading**
   - Use thumbnail URLs for grid views
   - Implement progressive loading
   - Cache frequently accessed images

2. **Memory Management**
   - Clean up blob URLs after use
   - Limit concurrent image processing
   - Monitor memory usage in dev tools

## 📄 API Reference

### Google Drive Service

```typescript
// Initialize connection
await googleDriveService.initialize();

// Authenticate user
await googleDriveService.signIn();

// Get folder contents
const photos = await googleDriveService.getPhotosFromFolder(folderId);

// Upload generated template
await googleDriveService.uploadFile(blob, fileName, folderId);
```

### Template Generation Service

```typescript
// Generate template
const result = await templateGenerationService.generateTemplate(template);

// Generate preview
const preview = await templateGenerationService.generatePreview(template);

// Download template
await templateGenerationService.downloadTemplate(generatedTemplate);
```

## 🤝 Contributing

1. **Fork the repository**
2. **Create feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit changes** (`git commit -m 'Add amazing feature'`)
4. **Push to branch** (`git push origin feature/amazing-feature`)
5. **Open Pull Request**

### Development Guidelines

- Follow TypeScript best practices
- Use Tailwind CSS for styling
- Write comprehensive tests
- Document new features
- Optimize for tablet performance

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, please contact:
- **Email**: support@pronoia.studio
- **Documentation**: [GitHub Wiki](link-to-wiki)
- **Issues**: [GitHub Issues](link-to-issues)

## 🔄 Version History

- **v1.0.0** - Initial release with core functionality
- **v1.1.0** - Added batch operations and quick templates
- **v1.2.0** - Enhanced touch interface and tablet optimization

---

**Built with ❤️ for professional photo studios** 