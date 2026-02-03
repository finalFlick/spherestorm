#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
}

function updateIndexHtml(version) {
    let content = fs.readFileSync(INDEX_FILE, 'utf8');
    content = content.replace(/<div id="version-display">v[^<]+<\/div>/, `<div id="version-display">v${version}</div>`);
    content = content.replace(/src="dist\/bundle\.js[^"]*"/, `src="dist/bundle.js?v=${version}"`);
    fs.writeFileSync(INDEX_FILE, content);
    console.log('  ✓ index.html');
}

function createGitTag(version) {
    const tag = `v${version}`;
    try {
        execSync(`git tag -a ${tag} -m "Release ${tag}"`, { cwd: ROOT, stdio: 'pipe' });
        console.log(`  ✓ Git tag ${tag}`);
        return true;
    } catch (e) {
        if (e.message.includes('already exists')) {
            console.log(`  - Tag ${tag} already exists`);
        }
        return false;
    }
}

const newVersion = process.argv[2];
if (newVersion) {
    if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
        console.error('Error: Version must be X.Y.Z format');
        process.exit(1);
    }
    setVersion(newVersion);
}

const version = newVersion || getVersion();
console.log(`Version: ${version}`);
updateIndexHtml(version);
fs.writeFileSync(VERSION_FILE, version + '\n');
console.log('  ✓ VERSION');
createGitTag(version);
console.log('\nDone. Remember to push tags: git push --tags\n');
