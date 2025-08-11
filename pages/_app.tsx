// Updated: App component..
import '../styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { Toaster } from 'react-hot-toast';
import ServiceWorkerRegistration from '../components/ServiceWorkerRegistration';
import { useViewportHeight } from '../hooks/useViewportHeight';

export default function App({ Component, pageProps }: AppProps) {
  // Track viewport height for mobile browser compatibility
  useViewportHeight();
  
  return (
    <>
      <Head>
        {/* Mobile-optimized viewport configuration */}
        <meta 
          name="viewport" 
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, minimal-ui"
        />
      </Head>
      <ServiceWorkerRegistration />
      <Component {...pageProps} />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#4ade80',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </>
  );
} 