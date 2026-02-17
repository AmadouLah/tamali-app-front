const fs = require('fs');
const path = require('path');

const sharp = require('sharp');

const sourceLogo = path.join(__dirname, '../src/assets/icons/LogoImages.png');
const outputDir = path.join(__dirname, '../src/assets/icons');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  if (!fs.existsSync(sourceLogo)) {
    console.error(`Logo source introuvable: ${sourceLogo}`);
    console.log('Veuillez placer votre logo dans: src/assets/icons/LogoImages.png');
    process.exit(1);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('Génération des icônes PWA...');

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);
    try {
      await sharp(sourceLogo)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 15, g: 23, b: 42, alpha: 1 }
        })
        .png()
        .toFile(outputPath);
      console.log(`✓ Généré: icon-${size}x${size}.png`);
    } catch (error) {
      console.error(`✗ Erreur pour ${size}x${size}:`, error.message);
    }
  }

  console.log('\n✓ Toutes les icônes ont été générées avec succès!');
}

generateIcons().catch(console.error);
