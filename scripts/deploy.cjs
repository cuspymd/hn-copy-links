const fs = require('fs');
const path = require('path');

const sourceDir = path.resolve(__dirname, '..');
const targetBrowser = process.argv[2] || 'chrome';

if (!['chrome', 'firefox'].includes(targetBrowser)) {
  console.error('Error: Browser must be either "chrome" or "firefox"');
  process.exit(1);
}

const filesToCopy = [
  'styles.css',
];

const directoriesToCopy = [
  'content-scripts',
  'options',
  'shared',
  'constants',
  '_locales',
  'images',
];

const manifestFile = targetBrowser === 'firefox' ? 'manifest-firefox.json' : 'manifest.json';
const currentDeployDir = path.join(sourceDir, targetBrowser === 'firefox' ? 'dist-firefox' : 'dist');

if (fs.existsSync(currentDeployDir)) {
  fs.rmSync(currentDeployDir, { recursive: true, force: true });
}
fs.mkdirSync(currentDeployDir);

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`Copied: ${path.relative(sourceDir, dest)}`);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else copyFile(srcPath, destPath);
  }
}

const manifestSrc = path.join(sourceDir, manifestFile);
if (fs.existsSync(manifestSrc)) {
  copyFile(manifestSrc, path.join(currentDeployDir, 'manifest.json'));
} else {
  console.warn(`Warning: ${manifestFile} not found`);
}

for (const file of filesToCopy) {
  const src = path.join(sourceDir, file);
  if (fs.existsSync(src)) copyFile(src, path.join(currentDeployDir, file));
  else console.warn(`Warning: ${file} not found`);
}

for (const dir of directoriesToCopy) {
  const src = path.join(sourceDir, dir);
  if (fs.existsSync(src)) copyDir(src, path.join(currentDeployDir, dir));
  else console.warn(`Warning: ${dir} directory not found`);
}

console.log(`\nDeploy completed to: ${path.relative(sourceDir, currentDeployDir)}`);
if (targetBrowser === 'firefox') {
  console.log('Load it from "dist-firefox" in Firefox:');
  console.log('about:debugging -> This Firefox -> Load Temporary Add-on -> dist-firefox/manifest.json');
} else {
  console.log('Load it from "dist" in Chrome:');
  console.log('chrome://extensions -> Enable Developer mode -> Load unpacked');
}
