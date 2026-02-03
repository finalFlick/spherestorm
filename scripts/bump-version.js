#!/usr/bin/env node
/**
 * Version Bump Script
 * 
 * Single source of truth: js/config/constants.js
 * This script reads the VERSION from constants.js and updates all references.
 * 
 * Usage:
 *   node scripts/bump-version.js           # Sync all files to current VERSION
 *   node scripts/bump-version.js 0.3.0     # Set new version and sync all files
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONSTANTS_FILE = path.join(ROOT, 'js/config/constants.js');
const INDEX_FILE = path.join(ROOT, 'index.html');
const VERSION_FILE = path.join(ROOT, 'VERSION');

// Read current version from constants.js
function getCurrentVersion() {
    const content = fs.readFileSync(CONSTANTS_FILE, 'utf8');
    const match = content.match(/export const VERSION = '([^']+)'/);
    if (!match) throw new Error('Could not find VERSION in constants.js');
    return match[1];
}

// Update version in constants.js
function updateConstantsVersion(newVersion) {
    let content = fs.readFileSync(CONSTANTS_FILE, 'utf8');
    content = content.replace(
        /export const VERSION = '[^']+'/,
        `export const VERSION = '${newVersion}'`
    );
    fs.writeFileSync(CONSTANTS_FILE, content);
    console.log(`  ✓ js/config/constants.js`);
}

// Update all version references in index.html
function updateIndexHtml(version) {
    let content = fs.readFileSync(INDEX_FILE, 'utf8');
    
    // Update loading-version div
    content = content.replace(
        /<div class="loading-version">v[^<]+<\/div>/,
        `<div class="loading-version">v${version}</div>`
    );
    
    // Update version-display div
    content = content.replace(
        /<div id="version-display">v[^<]+<\/div>/,
        `<div id="version-display">v${version}</div>`
    );
    
    // Update script cache-buster
    content = content.replace(
        /src="js\/main\.js\?v=[^"]+"/,
        `src="js/main.js?v=${version}"`
    );
    
    fs.writeFileSync(INDEX_FILE, content);
    console.log(`  ✓ index.html (loading-version, version-display, script tag)`);
}

// Update VERSION file
function updateVersionFile(version) {
    fs.writeFileSync(VERSION_FILE, version + '\n');
    console.log(`  ✓ VERSION`);
}

// Main
function main() {
    const newVersion = process.argv[2];
    
    if (newVersion) {
        // Validate semver format
        if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
            console.error('Error: Version must be in format X.Y.Z (e.g., 0.3.0)');
            process.exit(1);
        }
        console.log(`\nBumping version to ${newVersion}...\n`);
        updateConstantsVersion(newVersion);
    } else {
        console.log(`\nSyncing all files to current version...\n`);
    }
    
    const version = getCurrentVersion();
    console.log(`Version: ${version}\n`);
    
    updateIndexHtml(version);
    updateVersionFile(version);
    
    console.log(`\n✓ All version references updated to ${version}\n`);
}

main();
