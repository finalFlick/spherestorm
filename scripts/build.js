#!/usr/bin/env node
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
}

esbuild.buildSync({
    entryPoints: ['js/main.js'],
    bundle: true,
    minify: true,
    outfile: 'dist/bundle.js',
    format: 'esm',
    external: ['/js/config/debug.local.js']
});

const stats = fs.statSync('dist/bundle.js');
console.log(`✓ dist/bundle.js (${Math.round(stats.size / 1024)}KB)`);
