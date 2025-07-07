# Quick Start Guide

## 🚀 Get Running in 5 Minutes

### 1. Install Dependencies
```bash
npm install
```

### 2. Install Required Tailwind Plugins
```bash
npm install @tailwindcss/forms @tailwindcss/aspect-ratio
```

### 3. Set Up Google Drive API (Required)

**Option A: Use Demo Mode (Limited)**
- The app will work in demo mode without Google Drive
- Some features will be disabled

**Option B: Full Setup (Recommended)**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google Drive API
4. Create OAuth 2.0 credentials
5. Copy `env.example` to `.env.local`
6. Add your credentials to `.env.local`

### 4. Run the Development Server
```bash
npm run dev
```

### 5. Open in Browser
Navigate to [http://localhost:3000](http://localhost:3000)

## 📱 Tablet Testing

For the best experience, open in Chrome DevTools:
1. Press F12 to open DevTools
2. Click the device toggle icon
3. Select "iPad Pro" or similar tablet
4. Rotate to landscape orientation

## 🎯 First Test

1. **Select Package**: Choose any package (A, B, C, or D)
2. **Enter Client Name**: Type any name
3. **Google Drive**: Either connect or use demo mode
4. **Templates**: Add templates up to your package limit
5. **Photos**: Select photos for each template slot
6. **Preview**: Review and export your templates

## 🔧 Common Issues

**TypeScript Errors**: These are expected until dependencies are installed
**Build Errors**: Run `npm install` to resolve missing packages
**Google Drive Issues**: Check API credentials and browser console

## 📚 Next Steps

- Read the full README.md for detailed documentation
- Configure Google Drive API for full functionality
- Customize packages and templates in `utils/constants.ts`
- Deploy to Replit or Vercel for production use

---

**Need help?** Check the troubleshooting section in README.md 