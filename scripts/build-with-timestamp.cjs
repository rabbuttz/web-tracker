const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Clean old build files
function cleanReleaseDirectory() {
  const releaseDir = path.join(__dirname, '..', 'release');

  if (!fs.existsSync(releaseDir)) {
    console.log('Release directory does not exist, skipping cleanup');
    return;
  }

  console.log('\n=== Cleaning old build files ===\n');

  try {
    const files = fs.readdirSync(releaseDir);
    let deletedCount = 0;

    files.forEach(file => {
      const filePath = path.join(releaseDir, file);
      const stat = fs.statSync(filePath);

      // Only delete files (not directories)
      if (stat.isFile()) {
        // Delete .exe, .blockmap, .yaml files
        if (file.endsWith('.exe') || file.endsWith('.blockmap') || file.endsWith('.yaml')) {
          fs.unlinkSync(filePath);
          console.log(`  Deleted: ${file}`);
          deletedCount++;
        }
      }
    });

    console.log(`\nDeleted ${deletedCount} old file(s)\n`);
  } catch (error) {
    console.error('Error cleaning release directory:', error.message);
  }
}

// Clean old files before building
cleanReleaseDirectory();

// Generate timestamp
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const hour = String(now.getHours()).padStart(2, '0');
const minute = String(now.getMinutes()).padStart(2, '0');
const second = String(now.getSeconds()).padStart(2, '0');
const timestamp = `${year}${month}${day}-${hour}${minute}${second}`;

console.log(`=== Building with timestamp: ${timestamp} ===\n`);

// Read package.json
const packagePath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const backup = JSON.stringify(packageJson, null, 2);

// Update artifact names
if (!packageJson.build) packageJson.build = {};
if (!packageJson.build.nsis) packageJson.build.nsis = {};
if (!packageJson.build.portable) packageJson.build.portable = {};

packageJson.build.nsis.artifactName = `\${productName}-\${version}-${timestamp}.\${ext}`;
packageJson.build.portable.artifactName = `\${productName}-\${version}-${timestamp}-portable.\${ext}`;

console.log('Artifact names:');
console.log('  - Setup:', packageJson.build.nsis.artifactName);
console.log('  - Portable:', packageJson.build.portable.artifactName);
console.log('');

fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2), 'utf8');

try {
  // Run build
  execSync('npm run build && electron-builder --win', { stdio: 'inherit', shell: true });
  console.log('\n=== Build completed successfully ===\n');
} catch (error) {
  console.error('\n=== Build failed ===\n');
  throw error;
} finally {
  // Restore package.json
  fs.writeFileSync(packagePath, backup, 'utf8');
  console.log('package.json restored');
}
