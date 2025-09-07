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
      if (process.env.NODE_ENV === 'development') console.log('Logo not found. Creating placeholder icons...');
      
      // Create placeholder icons with "P" letter in circle
      for (const size of sizes) {
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        
        // Clear canvas with transparency
        ctx.clearRect(0, 0, size, size);
        
        // Enable anti-aliasing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw white circle background
        ctx.beginPath();
        ctx.arc(size/2, size/2, size/2 * 0.9, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        
        // Add subtle shadow for depth
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = size * 0.05;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = size * 0.02;
        
        // Draw inner circle with brand color
        ctx.beginPath();
        ctx.arc(size/2, size/2, size/2 * 0.85, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444'; // Red brand color from logo
        ctx.fill();
        
        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        
        // Letter "P"
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${size * 0.4}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('P', size/2, size/2);
        
        // Save icon
        const buffer = canvas.toBuffer('image/png');
        const outputPath = path.join(__dirname, `../public/icons/icon-${size}x${size}.png`);
        fs.writeFileSync(outputPath, buffer);
        if (process.env.NODE_ENV === 'development') console.log(`Created circular icon: ${size}x${size}`);
      }
    } else {
      // Use existing logo
      const logo = await loadImage(logoPath);
      
      for (const size of sizes) {
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        
        // Clear canvas with transparency
        ctx.clearRect(0, 0, size, size);
        
        // Enable anti-aliasing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Create circular clipping path
        ctx.save();
        ctx.beginPath();
        ctx.arc(size/2, size/2, size/2 * 0.95, 0, Math.PI * 2);
        ctx.clip();
        
        // Draw white circle background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        
        // Draw the logo centered in the circle
        const logoSize = size * 0.75; // Logo takes 75% of circle
        const offset = (size - logoSize) / 2;
        ctx.drawImage(logo, offset, offset, logoSize, logoSize);
        
        // Restore context
        ctx.restore();
        
        // Add circular border for definition
        ctx.beginPath();
        ctx.arc(size/2, size/2, size/2 * 0.95, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.lineWidth = size * 0.01;
        ctx.stroke();
        
        // Save icon
        const buffer = canvas.toBuffer('image/png');
        const outputPath = path.join(__dirname, `../public/icons/icon-${size}x${size}.png`);
        fs.writeFileSync(outputPath, buffer);
        if (process.env.NODE_ENV === 'development') console.log(`Generated circular icon: ${size}x${size}`);
      }
    }
    
    if (process.env.NODE_ENV === 'development') console.log('All circular icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons();