#!/usr/bin/env node
// Bumps the manifest version, forces debug logging off, builds the package and
// zips it into outputs/ under the name the release skill expects.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');

const version = process.argv[2];
const browser = process.argv[3] || 'chrome';

if (!version) {
  console.error('Error: Version argument is required');
  console.log('Usage: node scripts/version-deploy.cjs <version> [chrome|firefox]');
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Error: Version must look like 1.2.3, got "${version}"`);
  process.exit(1);
}

if (!['chrome', 'firefox'].includes(browser)) {
  console.error('Error: Browser must be either "chrome" or "firefox"');
  process.exit(1);
}

const sourceDir = path.resolve(__dirname, '..');
const manifestFile = browser === 'firefox' ? 'manifest-firefox.json' : 'manifest.json';
const manifestPath = path.join(sourceDir, manifestFile);
const outputsDir = path.join(sourceDir, 'outputs');
const buildDir = path.join(sourceDir, browser === 'firefox' ? 'dist-firefox' : 'dist');
const zipFileName = `hn-copy-links-${version}-${browser}.zip`;

console.log(`Starting version deploy for version: ${version} (${browser})`);

console.log(`\n1. Updating ${manifestFile} version...`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.version = version;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`OK Updated ${manifestFile} version to ${version}`);

console.log('\n2. Setting DEBUG_MODE to false...');
// shared/logger.js is the single source of the flag for every script.
const loggerPath = path.join(sourceDir, 'shared', 'logger.js');
const logger = fs.readFileSync(loggerPath, 'utf8');
const releaseLogger = logger.replace(/const DEBUG_MODE = true/g, 'const DEBUG_MODE = false');
if (releaseLogger === logger && !/const DEBUG_MODE = false/.test(logger)) {
  console.error('Error: could not find the DEBUG_MODE declaration in shared/logger.js');
  process.exit(1);
}
fs.writeFileSync(loggerPath, releaseLogger);
console.log('OK DEBUG_MODE is false in shared/logger.js');

console.log('\n3. Running deploy script...');
execSync(`node scripts/deploy.cjs ${browser}`, { cwd: sourceDir, stdio: 'inherit' });

console.log('\n4. Creating zip archive...');
fs.mkdirSync(outputsDir, { recursive: true });
const zipPath = path.join(outputsDir, zipFileName);

const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  const sizeKb = (archive.pointer() / 1024).toFixed(1);
  console.log(`OK Wrote outputs/${zipFileName} (${sizeKb} KB)`);
  console.log('\nVersion deploy completed.');
});

archive.on('error', (error) => {
  console.error('Error creating zip:', error.message);
  process.exit(1);
});

archive.pipe(output);
archive.directory(buildDir, false);
archive.finalize();
