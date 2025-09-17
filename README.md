# PronoiaApp V2 - SaaS Photo Studio Platform

A multi-tenant SaaS platform for photo studios to create, manage, and export professional photo templates with visual design tools and Google Drive integration.

## 🎯 Overview

PronoiaApp V2 is a complete rewrite as a modern SaaS platform that enables photo studios to:
- Create custom photo templates with a visual drag-and-drop designer
- Manage multiple client sessions and photo collections
- Export professional-quality templates to Google Drive
- Customize branding per organization
- Track usage and manage subscriptions

## ✨ Key Features

### Multi-tenant Architecture
- **Organization Management**: Isolated workspaces for each photo studio
- **Custom Branding**: Logo, colors, fonts per organization
- **Team Collaboration**: Role-based access control (coming in v2.1)
- **Data Isolation**: Complete separation between organizations

### Visual Template Designer
- **Drag & Drop Interface**: Create photo slots visually
- **Pixel-Precise Control**: Fine-tune positioning with keyboard and mouse
- **Smart Guides**: Automatic alignment and snapping
- **Real-time Preview**: See how photos will look in templates
- **Auto-save**: Never lose your work

### Google Drive Integration
- **Per-Organization**: Each org connects their own Google Drive
- **Secure Token Management**: Server-side OAuth with encryption
- **Folder Browser**: Navigate and select photos easily
- **Batch Export**: Export multiple templates at once

### Subscription & Billing
- **Flexible Plans**: Starter (₱500/mo) and Professional (₱1000/mo)
- **Usage Tracking**: Monitor sessions per month
- **14-Day Free Trial**: Full access to test the platform
- **PayMaya Ready**: Payment integration (coming soon)

## 🚀 Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui with Radix UI
- **Backend**: Supabase (Auth, Database, Storage)
- **Canvas**: Fabric.js for template designer
- **State Management**: Zustand
- **Deployment**: Vercel

## 📋 Requirements

- Node.js 18.0.0 or higher
- Supabase account and project
- Google Cloud Console project (for Drive API)
- Modern browser with Canvas support

## 🛠 Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd pronoia-v2
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up Supabase
```bash
# Install Supabase CLI
npm install -g supabase

# Initialize Supabase
supabase init

# Start local Supabase
supabase start
```

### 4. Configure environment variables
```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Google OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Set up database schema
```bash
# Run migrations
supabase db push

# Generate TypeScript types
npm run generate:types
```

### 6. Install shadcn/ui components
```bash
npx shadcn@latest init
npx shadcn@latest add button card dialog sheet tabs
npx shadcn@latest add form input select textarea
```

### 7. Start development server
```bash
npm run dev
```

Visit `http://localhost:3000` to see the app.

## 📁 Project Structure

```
pronoia-v2/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Public auth pages
│   ├── (app)/             # Protected app pages
│   │   └── [org]/         # Organization context
│   └── api/               # API routes
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── studio/            # Studio components
│   └── organization/      # Org management
├── lib/
│   ├── supabase/          # Supabase client
│   ├── services/          # Business logic
│   └── stores/            # Zustand stores
└── public/                # Static assets
```

## 🔒 Security

- **Row Level Security**: All database tables protected with RLS
- **Encrypted Tokens**: OAuth tokens encrypted at rest
- **Server-side Exchange**: No client-side token exposure
- **Organization Isolation**: Complete data separation

## 🧪 Testing

```bash
# Run unit tests
npm run test

# Run E2E tests
npm run test:e2e

# Type checking
npm run type-check
```

## 📦 Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import project in Vercel
3. Configure environment variables
4. Deploy

### Manual Deployment
```bash
# Build for production
npm run build

# Start production server
npm run start
```

## 📚 Documentation

- [Product Requirements](docs/PRD_SaaS.md)
- [API Documentation](docs/API.md)
- [Database Schema](docs/SCHEMA.md)
- [Deployment Guide](docs/DEPLOYMENT.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is proprietary software. All rights reserved.

## 🆘 Support

For issues and questions:
- Create an issue on GitHub
- Email: support@pronoia.app
- Documentation: [docs.pronoia.app](https://docs.pronoia.app)

## 🚦 Status

- **Current Version**: 2.0.0
- **Status**: In Development
- **Release Date**: Q1 2025

---

Built with ❤️ for photo studios worldwide