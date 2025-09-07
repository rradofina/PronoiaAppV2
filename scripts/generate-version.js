const fs = require('fs');
const path = require('path');

// Generate version info for deployment detection
const generateVersion = () => {
  // Use Vercel environment variables if available, otherwise use timestamp
  const version = {
    deploymentId: process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_URL || Date.now().toString(),
    buildTime: new Date().toISOString(),
    gitCommit: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
    gitBranch: process.env.VERCEL_GIT_COMMIT_REF || 'local',
    environment: process.env.VERCEL_ENV || 'development'
  };

  // Write version.json to public directory
  const versionPath = path.join(__dirname, '..', 'public', 'version.json');
  fs.writeFileSync(versionPath, JSON.stringify(version, null, 2));

  // Also update service worker with build version
  const swPath = path.join(__dirname, '..', 'public', 'service-worker.js');
  let swContent = fs.readFileSync(swPath, 'utf8');
  
  // Replace the BUILD_TIMESTAMP line with actual build time
  swContent = swContent.replace(
    /const BUILD_TIMESTAMP = .*?;/,
    `const BUILD_TIMESTAMP = '${version.buildTime}';`
  );
  
  // Replace the DEPLOYMENT_ID line or add it if not exists
  if (swContent.includes('const DEPLOYMENT_ID')) {
    swContent = swContent.replace(
      /const DEPLOYMENT_ID = .*?;/,
      `const DEPLOYMENT_ID = '${version.deploymentId}';`
    );
  } else {
    // Add after BUILD_TIMESTAMP
    swContent = swContent.replace(
      /const BUILD_TIMESTAMP = .*?;/,
      `const BUILD_TIMESTAMP = '${version.buildTime}';\nconst DEPLOYMENT_ID = '${version.deploymentId}';`
    );
  }
  
  fs.writeFileSync(swPath, swContent);

  if (process.env.NODE_ENV === 'development') console.log('✅ Version generated:', version);
  return version;
};

// Run if called directly
if (require.main === module) {
  generateVersion();
}

module.exports = generateVersion;