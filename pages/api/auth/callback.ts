import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code } = req.query;
  if (!code) {
    res.status(400).send('Missing code');
    return;
  }

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  // --- Start Vercel Debugging ---
  if (process.env.NODE_ENV === 'production') {
    if (!clientSecret) {
      res.status(500).send('Vercel server is not loading the GOOGLE_CLIENT_SECRET environment variable. Please check Vercel project settings.');
      return;
    }
  }
  // --- End Vercel Debugging ---

  // Determine the redirect URI based on the environment
  const redirectUri = process.env.NODE_ENV === 'production'
    ? 'https://pronoia-app.vercel.app/api/auth/callback'
    : 'http://localhost:3000/api/auth/callback';

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: code as string,
      client_id: clientId || '',
      client_secret: clientSecret || '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('Token exchange failed:', data);
    res.status(500).send(`Token exchange failed: ${JSON.stringify(data)}`);
    return;
  }

  // Return script to set tokens in localStorage and redirect
  res.send(`
    <script>
      localStorage.setItem('google_access_token', '${data.access_token}');
      localStorage.setItem('google_refresh_token', '${data.refresh_token}');
      localStorage.setItem('google_token_expiry', ${Date.now() + data.expires_in * 1000});
      window.location.href = '/';
    </script>
  `);
} 