// ==================== DEBUG MODE CONFIG ====================
// Copy this file to debug.local.js to enable debug logging on localhost
// debug.local.js is gitignored and will NOT be committed
//
// Security: Debug mode requires BOTH:
//   1. Running on localhost or 127.0.0.1
//   2. This file exists as debug.local.js
//
// Usage: cp debug.local.example.js debug.local.js

export const DEBUG_SECRET = true;

// ==================== PLAYTEST FEEDBACK CONFIG ====================
// To enable in-game feedback collection:
//   1. Set up Google Apps Script (see docs/PLAYTEST_FORM_GUIDE.md)
//   2. Fill in the URL and token below
//   3. Copy this file to debug.local.js
//
// Leave commented out to disable feedback system
/*
export const PLAYTEST_CONFIG = {
    url: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
    token: 'your-secret-token'  // Must match PLAYTEST_TOKEN in Apps Script
};
*/