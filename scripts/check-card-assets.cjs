const fs = require('fs');
const path = require('path');

const expected = [
  '0. The Fool.png',
  '1. The Magician.png',
  '2. The High Priestess.png',
  '3. The Empress.png',
  '4. The Emperor.png',
  '5. The Hierophant.png',
  '6. The Lovers.png',
  '7. Chariot.png',
  '8. Strength.png',
  '9. The Hermit.png',
  '10. Wheel of Fortune.png',
  '11. Justice.png',
  '12. The Hanged Man.png',
  '13. Death.png',
  '14. Temperance.png',
  '15. The Devil.png',
  '16. The Tower.png',
  '17. The Star.png',
  '18. The Moon.png',
  '19. The Sun.png',
  '20. Judgement.png',
  '21. The World.png',
];

const cardDir = path.resolve(__dirname, '..', 'assets', 'card');
const missing = expected.filter((file) => !fs.existsSync(path.join(cardDir, file)));

if (missing.length > 0) {
  console.error('\n[card-assets] Production card images are missing.');
  console.error(`Expected directory: ${cardDir}`);
  console.error('Missing files:');
  missing.forEach((file) => console.error(`- ${file}`));
  console.error('\nLocal Android production builds require these files before bundling.');
  console.error('For EAS cloud builds, provide assets/card via Git LFS, a private package, a prebuild download, or another reproducible supply step.\n');
  process.exit(1);
}

console.log(`[card-assets] OK: ${expected.length} card images found in ${cardDir}`);
