#!/usr/bin/env node
/**
 * Version Bump Script - Single source of truth: js/config/constants.js
 * Usage: node scripts/bump-version.js [X.Y.Z]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
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

function updateIndexHtml(version) {
    let content = fs.readFileSync(INDEX_FILE, 'utf8');
    content = content.replace(/<div id="version-display">v[^<]+<\/div>/, `<div id="version-display">v${version}</div>`);
    content = content.replace(/src="js\/main\.js\?v=[^"]+"/, `src="js/main.js?v=${version}"`);
    fs.writeFileSync(INDEX_FILE, content);
    console.log('  ✓ index.html');
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
