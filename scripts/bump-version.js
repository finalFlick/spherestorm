#!/usr/bin/env node
/**
 * Version Bump Script
 * - Updates version in constants.js, index.html, VERSION file
 * - Generates modulepreload links for all JS files
 * Usage: node scripts/bump-version.js [X.Y.Z]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const JS_DIR = path.join(ROOT, 'js');
const CONSTANTS_FILE = path.join(ROOT, 'js/config/constants.js');
const INDEX_FILE = path.join(ROOT, 'index.html');
const VERSION_FILE = path.join(ROOT, 'VERSION');

function getVersion() {
    const content = fs.readFileSync(CONSTANTS_FILE, 'utf8');
    const match = content.match(/export const VERSION = '([^']+)'/);
    if (!match) throw new Error('VERSION not found in constants.js');
    return match[1];
}

function setVersion(version) {
    let content = fs.readFileSync(CONSTANTS_FILE, 'utf8');
    content = content.replace(/export const VERSION = '[^']+'/, `export const VERSION = '${version}'`);
    fs.writeFileSync(CONSTANTS_FILE, content);
    console.log('  ✓ js/config/constants.js');
    return version;
}

function getJsFiles(dir, files = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            getJsFiles(fullPath, files);
        } else if (entry.name.endsWith('.js') && !entry.name.includes('.local.')) {
            const relPath = path.relative(ROOT, fullPath).replace(/\\/g, '/');
            files.push(relPath);
        }
    }
    return files;
}

function updateIndexHtml(version) {
    let content = fs.readFileSync(INDEX_FILE, 'utf8');
    
    // Update version display
    content = content.replace(/<div id="version-display">v[^<]+<\/div>/, `<div id="version-display">v${version}</div>`);
    
    // Generate preload links for all JS files
    const jsFiles = getJsFiles(JS_DIR);
    const preloadLinks = jsFiles
        .map(f => `    <link rel="modulepreload" href="${f}">`)
        .join('\n');
    
    content = content.replace(
        /<!-- PRELOAD_START -->[\s\S]*?<!-- PRELOAD_END -->/,
        `<!-- PRELOAD_START -->\n${preloadLinks}\n    <!-- PRELOAD_END -->`
    );
    
    fs.writeFileSync(INDEX_FILE, content);
    console.log(`  ✓ index.html (${jsFiles.length} preload links)`);
}

const newVersion = process.argv[2];

if (newVersion) {
    if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
        console.error('Error: Version must be X.Y.Z format');
        process.exit(1);
    }
    console.log(`\nSetting version to ${newVersion}...`);
    setVersion(newVersion);
}

const version = newVersion || getVersion();
console.log(`Version: ${version}`);
updateIndexHtml(version);
fs.writeFileSync(VERSION_FILE, version + '\n');
console.log('  ✓ VERSION');
console.log(`\nDone.\n`);
