const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sourceLogo = path.join(__dirname, '../src/assets/icons/LogoImages.png');
const outputFavicon = path.join(__dirname, '../src/favicon.png');

async function generateFavicon() {
  if (!fs.existsSync(sourceLogo)) {
    console.error(`Logo source introuvable: ${sourceLogo}`);
    process.exit(1);
  }

  try {
    await sharp(sourceLogo)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 15, g: 23, b: 42, alpha: 1 }
      })
      .png()
      .toFile(outputFavicon);
    
    console.log('✓ Favicon généré avec succès!');
  } catch (error) {
    console.error('✗ Erreur lors de la génération du favicon:', error.message);
  }
}

generateFavicon().catch(console.error);
