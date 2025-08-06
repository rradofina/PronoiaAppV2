const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

// Icon sizes needed for PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  try {
    // Load the source logo
    const logoPath = path.join(__dirname, '../public/images/pronoia_logo.png');
    
    // Check if logo exists
    if (!fs.existsSync(logoPath)) {
      console.log('Logo not found. Creating placeholder icons...');
      
      // Create placeholder icons with "P" letter
      for (const size of sizes) {
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        
        // Background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, size, size);
        
        // Circle background
        ctx.beginPath();
        ctx.arc(size/2, size/2, size/2 * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        
        // Letter "P"
        ctx.fillStyle = '#000000';
        ctx.font = `bold ${size * 0.5}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('P', size/2, size/2);
        
        // Save icon
        const buffer = canvas.toBuffer('image/png');
        const outputPath = path.join(__dirname, `../public/icons/icon-${size}x${size}.png`);
        fs.writeFileSync(outputPath, buffer);
        console.log(`Created icon: ${size}x${size}`);
      }
    } else {
      // Use existing logo
      const logo = await loadImage(logoPath);
      
      for (const size of sizes) {
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        
        // Black background for better contrast
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, size, size);
        
        // Draw logo centered and scaled
        const padding = size * 0.1; // 10% padding
        const drawSize = size - (padding * 2);
        ctx.drawImage(logo, padding, padding, drawSize, drawSize);
        
        // Save icon
        const buffer = canvas.toBuffer('image/png');
        const outputPath = path.join(__dirname, `../public/icons/icon-${size}x${size}.png`);
        fs.writeFileSync(outputPath, buffer);
        console.log(`Generated icon: ${size}x${size}`);
      }
    }
    
    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons();