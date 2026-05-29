const pngToIco = require('png-to-ico').default;
const fs = require('fs');
const path = require('path');

async function generateIco() {
  try {
    console.log('Generating .ico file from PNG...');

    const iconPath = path.join(__dirname, '..', 'public', 'icons', 'icon-512x512.png');
    const outputPath = path.join(__dirname, '..', 'public', 'icons', 'icon.ico');

    const icoData = await pngToIco(iconPath);
    fs.writeFileSync(outputPath, icoData);

    console.log('✅ Successfully created icon.ico');
  } catch (error) {
    console.error('❌ Error generating .ico file:', error);
    process.exit(1);
  }
}

generateIco();
