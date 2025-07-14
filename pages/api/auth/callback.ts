import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code } = req.query;
  if (!code) {
    res.status(400).send('Missing code');
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${req.headers.host}/api/auth/callback`;

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
    res.status(500).send('Token exchange failed');
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