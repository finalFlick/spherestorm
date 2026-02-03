/**
 * Playtest Feedback System
 * 
 * Handles the in-game feedback form submission to Google Apps Script.
 * Collects responses and game metadata, sends to backend for storage.
 */

import { VERSION } from '../config/constants.js';
import { gameState } from '../core/gameState.js';
import { gameStartTime } from '../ui/hud.js';

// ============================================================================
// Configuration
// ============================================================================

let config = {
    url: '',
    token: ''
};

/**
 * Initialize playtest feedback with config from debug.local.js
 * @param {Object} cfg - { url: string, token: string }
 */
export function initPlaytestFeedback(cfg) {
    if (cfg && cfg.url && cfg.token) {
        config = cfg;
        console.log('[Playtest] Feedback system initialized');
    }
}

/**
 * Check if feedback system is configured
 */
export function isFeedbackEnabled() {
    return !!(config.url && config.token);
}

/**
 * Test the feedback connection
 * Sends a test payload to Apps Script and reports success/failure
 * @returns {Promise<{success: boolean, message: string, details?: object}>}
 */
export async function testFeedbackConnection() {
    console.log('[Playtest] Testing connection...');
    
    // Check if configured
    if (!isFeedbackEnabled()) {
        const msg = 'Not configured - add PLAYTEST_CONFIG to debug.local.js';
        console.warn('[Playtest] ' + msg);
        return { success: false, message: msg };
    }
    
    // Validate URL format
    if (!config.url.includes('/AKfycb')) {
        const msg = 'Invalid URL - should contain AKfycb deployment ID';
        console.warn('[Playtest] ' + msg);
        console.warn('[Playtest] Current URL: ' + config.url.substring(0, 60) + '...');
        return { success: false, message: msg };
    }
    
    const startTime = Date.now();
    const testPayload = {
        token: config.token,
        test: true,  // Signal this is a test request
        timestamp: new Date().toISOString()
    };
    
    console.log('[Playtest] URL: ' + config.url.substring(0, 60) + '...');
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(config.url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(testPayload),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const elapsed = Date.now() - startTime;
        
        if (response.ok) {
            let data;
            try {
                data = await response.json();
            } catch {
                data = { raw: await response.text() };
            }
            
            console.log('[Playtest] Connection successful!');
            console.log('[Playtest] Response:', data);
            console.log('[Playtest] Round-trip time: ' + elapsed + 'ms');
            
            return { 
                success: true, 
                message: 'Connected (' + elapsed + 'ms)',
                details: data
            };
        } else {
            const status = response.status;
            console.error('[Playtest] HTTP ' + status);
            return { 
                success: false, 
                message: 'HTTP ' + status,
                details: { status }
            };
        }
    } catch (error) {
        const elapsed = Date.now() - startTime;
        
        if (error.name === 'AbortError') {
            console.error('[Playtest] Timeout after 10s');
            return { success: false, message: 'Timeout (10s)' };
        }
        
        if (error.message.includes('Failed to fetch')) {
            console.error('[Playtest] CORS/Network error');
            console.error('[Playtest] → Check Apps Script: Deploy → Manage deployments');
            console.error('[Playtest] → Set "Who has access" to "Anyone"');
            console.error('[Playtest] → Create NEW deployment if needed');
            return { success: false, message: 'CORS error - check Apps Script permissions' };
        }
        
        console.error('[Playtest] Error:', error.message);
        return { success: false, message: error.message };
    }
}

// ============================================================================
// Form State
// ============================================================================

const formState = {
    q1: null,  // Fun rating (1-5)
    q2: null,  // Controls
    q3: null,  // Clarity
    q4: null,  // Difficulty
    q5: null,  // Play again
    openFeedback: '',
    testerName: ''
};

/**
 * Reset form state
 */
export function resetFeedbackForm() {
    formState.q1 = null;
    formState.q2 = null;
    formState.q3 = null;
    formState.q4 = null;
    formState.q5 = null;
    formState.openFeedback = '';
    formState.testerName = '';
    
    // Clear UI selections
    document.querySelectorAll('.feedback-rating-btn.selected, .feedback-option.selected')
        .forEach(el => el.classList.remove('selected'));
    
    const openEl = document.getElementById('feedback-open');
    const nameEl = document.getElementById('feedback-name');
    if (openEl) openEl.value = '';
    if (nameEl) nameEl.value = '';
    
    const statusEl = document.getElementById('feedback-status');
    if (statusEl) {
        statusEl.textContent = '';
        statusEl.className = 'feedback-status';
    }
}

// ============================================================================
// Form Interaction
// ============================================================================

/**
 * Initialize form event listeners
 */
export function initFeedbackFormListeners() {
    // Q1: Rating buttons (1-5)
    const q1Container = document.getElementById('feedback-q1');
    if (q1Container) {
        q1Container.querySelectorAll('.feedback-rating-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                q1Container.querySelectorAll('.feedback-rating-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                formState.q1 = btn.dataset.value;
            });
        });
    }
    
    // Q2-Q5: Option buttons
    ['q2', 'q3', 'q4', 'q5'].forEach(qId => {
        const container = document.getElementById(`feedback-${qId}`);
        if (container) {
            container.querySelectorAll('.feedback-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    container.querySelectorAll('.feedback-option').forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                    formState[qId] = opt.dataset.value;
                });
            });
        }
    });
    
    // Open feedback textarea
    const openEl = document.getElementById('feedback-open');
    if (openEl) {
        openEl.addEventListener('input', () => {
            formState.openFeedback = openEl.value;
        });
    }
    
    // Tester name input
    const nameEl = document.getElementById('feedback-name');
    if (nameEl) {
        nameEl.addEventListener('input', () => {
            formState.testerName = nameEl.value;
        });
    }
    
    // Submit button
    const submitBtn = document.getElementById('feedback-submit');
    if (submitBtn) {
        submitBtn.addEventListener('click', handleSubmit);
    }
    
    // Skip button
    const skipBtn = document.getElementById('feedback-skip');
    if (skipBtn) {
        skipBtn.addEventListener('click', handleSkip);
    }
    
    // Update version display
    const versionEl = document.getElementById('feedback-version');
    if (versionEl) {
        versionEl.textContent = `v${VERSION}`;
    }
}

// ============================================================================
// Submission
// ============================================================================

/**
 * Validate Apps Script URL format
 * @returns {Object} { valid: boolean, warning?: string }
 */
function validateUrl() {
    const url = config.url;
    
    if (!url) {
        return { valid: false, warning: 'URL not configured' };
    }
    
    // Check if it's an Apps Script URL
    if (!url.includes('script.google.com/macros')) {
        return { 
            valid: false, 
            warning: 'URL is not a Google Apps Script deployment URL'
        };
    }
    
    // Check for correct deployment ID format (starts with AKfycb)
    if (!url.includes('/AKfycb')) {
        return { 
            valid: false, 
            warning: 'URL does not contain a valid Apps Script deployment ID (should contain "AKfycb")\n' +
                     '  → You may have copied the Sheet ID instead of the deployment URL\n' +
                     '  → Go to Apps Script → Deploy → Manage deployments → Copy Web app URL'
        };
    }
    
    return { valid: true };
}

/**
 * Get redacted URL for logging (shows first 50 chars)
 */
function getRedactedUrl() {
    if (!config.url) return '(not configured)';
    if (config.url.length <= 55) return config.url;
    return config.url.substring(0, 55) + '...';
}

/**
 * Handle form submission
 */
async function handleSubmit() {
    const submitBtn = document.getElementById('feedback-submit');
    const statusEl = document.getElementById('feedback-status');
    
    if (!isFeedbackEnabled()) {
        console.warn('[Playtest] Feedback system not configured');
        console.warn('  → Create js/config/debug.local.js with PLAYTEST_CONFIG');
        if (statusEl) {
            statusEl.textContent = 'Feedback system not configured';
            statusEl.className = 'feedback-status error';
        }
        return;
    }
    
    // Validate URL format before attempting fetch
    const urlCheck = validateUrl();
    if (!urlCheck.valid) {
        console.error('[Playtest] Invalid URL configuration:');
        console.error('  ' + urlCheck.warning);
        console.error('  Current URL: ' + getRedactedUrl());
        if (statusEl) {
            statusEl.textContent = 'Configuration error. Check console for details.';
            statusEl.className = 'feedback-status error';
        }
        return;
    }
    
    // Disable button during submission
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
    }
    
    // Calculate survival time
    const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Build payload
    const payload = {
        token: config.token,
        version: VERSION,
        arena: gameState.currentArena,
        wave: gameState.currentWave,
        score: gameState.score,
        time: timeStr,
        q1: formState.q1 || '',
        q2: formState.q2 || '',
        q3: formState.q3 || '',
        q4: formState.q4 || '',
        q5: formState.q5 || '',
        openFeedback: formState.openFeedback || '',
        testerName: formState.testerName || ''
    };
    
    console.log('[Playtest] Submitting to: ' + getRedactedUrl());
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        // Use text/plain to avoid CORS preflight (OPTIONS request)
        // Apps Script will still receive the JSON string in the body
        const response = await fetch(config.url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            console.log('[Playtest] Feedback submitted successfully!');
            if (statusEl) {
                statusEl.textContent = 'Thanks! Your feedback was sent.';
                statusEl.className = 'feedback-status success';
            }
            
            // Wait a moment then close
            setTimeout(() => {
                hideFeedbackOverlay();
                // Only show play-again prompt after actual gameplay (boss defeat or death), not from menu/pause
                if (feedbackContext === 'boss1' || feedbackContext === 'death') {
                    showPlayAgainPrompt();
                }
            }, 1500);
        } else {
            // HTTP error (4xx, 5xx)
            const statusCode = response.status;
            console.error(`[Playtest] Server returned HTTP ${statusCode}`);
            if (statusCode === 401 || statusCode === 403) {
                console.error('  → Token mismatch: Ensure token in debug.local.js matches PLAYTEST_TOKEN in Apps Script');
            }
            throw new Error(`HTTP ${statusCode}`);
        }
    } catch (error) {
        // Categorize and explain the error
        let userMessage = 'Couldn\'t send. Check console for details.';
        
        if (error.name === 'AbortError') {
            console.error('[Playtest] Request timed out after 5 seconds');
            console.error('  → Check your internet connection');
            console.error('  → The Apps Script may be slow or unresponsive');
            userMessage = 'Request timed out. Try again?';
        } else if (error.message.includes('Failed to fetch')) {
            console.error('[Playtest] Network error: Failed to fetch');
            console.error('  → Most likely cause: Apps Script requires sign-in');
            console.error('  → Fix: In Apps Script, go to Deploy → Manage deployments');
            console.error('  → Set "Who has access" to "Anyone" (not "Anyone with Google Account")');
            console.error('  → Then click Deploy to save changes');
            console.error('  → URL: ' + getRedactedUrl());
            userMessage = 'Network error. See console for fix.';
        } else if (error.message.startsWith('HTTP')) {
            userMessage = `Server error (${error.message}). Try again?`;
        } else {
            console.error('[Playtest] Unexpected error:', error.message);
            console.error('  → URL: ' + getRedactedUrl());
        }
        
        if (statusEl) {
            statusEl.textContent = userMessage;
            statusEl.className = 'feedback-status error';
        }
        
        // Re-enable button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit';
        }
    }
}

/**
 * Handle skip button
 */
function handleSkip() {
    hideFeedbackOverlay();
    // Only show play-again prompt after actual gameplay (boss defeat or death), not from menu/pause
    if (feedbackContext === 'boss1' || feedbackContext === 'death') {
        showPlayAgainPrompt();
    }
}

// ============================================================================
// Overlay Control
// ============================================================================

let feedbackContext = null; // 'boss1', 'death', 'pause', 'menu'

/**
 * Show the feedback overlay
 * @param {string} context - Why the overlay is being shown
 */
export function showFeedbackOverlay(context = 'menu') {
    feedbackContext = context;
    resetFeedbackForm();
    
    const overlay = document.getElementById('feedback-overlay');
    if (overlay) {
        overlay.classList.add('visible');
    }
    
    // Re-enable submit button
    const submitBtn = document.getElementById('feedback-submit');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
    }
}

/**
 * Hide the feedback overlay
 */
export function hideFeedbackOverlay() {
    const overlay = document.getElementById('feedback-overlay');
    if (overlay) {
        overlay.classList.remove('visible');
    }
}

/**
 * Show the play again prompt
 */
export function showPlayAgainPrompt() {
    const prompt = document.getElementById('play-again-prompt');
    if (prompt) {
        prompt.classList.add('visible');
    }
}

/**
 * Hide the play again prompt
 */
export function hidePlayAgainPrompt() {
    const prompt = document.getElementById('play-again-prompt');
    if (prompt) {
        prompt.classList.remove('visible');
    }
}

/**
 * Check if feedback overlay is visible
 */
export function isFeedbackOverlayVisible() {
    const overlay = document.getElementById('feedback-overlay');
    return overlay && overlay.classList.contains('visible');
}
