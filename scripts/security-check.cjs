const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

let hasError = false;

walkDir(srcDir, (filePath) => {
  const relPath = path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/');
  
  // 1) Prevent client-side direct AI secret usage
  if (relPath !== 'src/services/supabase.js' && filePath.endsWith('.js')) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('EXPO_PUBLIC_GOOGLE_API_KEY')) {
      console.error(`🚨 Client-side AI secret reference detected in ${relPath}`);
      hasError = true;
    }
  }
  
  // 2) Ensure deprecated hook files do not return
  if (relPath === 'src/hooks/useOpenAI.js' || relPath === 'src/services/openaiService.js') {
    console.error(`🚨 Deprecated OpenAI file detected: ${relPath}`);
    hasError = true;
  }
});

if (hasError) {
  process.exit(1);
} else {
  console.log('✅ security-check passed');
}
