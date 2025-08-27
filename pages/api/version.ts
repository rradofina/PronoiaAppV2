import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Read version.json from public directory
    const versionPath = path.join(process.cwd(), 'public', 'version.json');
    
    if (fs.existsSync(versionPath)) {
      const version = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
      
      // Set no-cache headers for version endpoint
      res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.status(200).json(version);
    } else {
      // Fallback version info if file doesn't exist
      res.status(200).json({
        deploymentId: process.env.VERCEL_GIT_COMMIT_SHA || 'development',
        buildTime: new Date().toISOString(),
        gitCommit: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
        gitBranch: process.env.VERCEL_GIT_COMMIT_REF || 'local',
        environment: process.env.VERCEL_ENV || 'development'
      });
    }
  } catch (error) {
    console.error('Error reading version:', error);
    res.status(500).json({ error: 'Failed to get version info' });
  }
}