/**
 * Debug Logging System
 * 
 * Thin wrapper around loglevel (CDN) providing:
 * - Tag-based filtering (enable/disable per category)
 * - Throttling (logThrottled) and deduplication (logOnce)
 * - Context injection (arena, wave)
 * - Assertion helpers
 * 
 * Usage:
 *   import { log, logWarn, logOnce, logThrottled, assert } from './debugLog.js';
 *   log('BOSS', 'spawn', { phase: 1, hp: 1000 });
 *   logOnce('boss-spawn-1', 'BOSS', 'first_spawn', { id: 1 });
 *   logThrottled('enemy-count', 1000, 'PERF', 'enemy_count', { count: 50 });
 *   assert(hp > 0, 'BOSS', 'hp_positive', { hp });
 */

// Import with fallback for cache compatibility
let DEBUG_CONFIG;
try {
    const constants = await import('../config/constants.js');
    DEBUG_CONFIG = constants.DEBUG_CONFIG || { level: 'silent', tags: {} };
} catch {
    DEBUG_CONFIG = { level: 'silent', tags: {} };
}

// State for throttling and deduplication
const loggedOnceKeys = new Set();
const throttleTimestamps = new Map();

// Get context from gameState (lazy import to avoid circular deps)
let gameStateRef = null;
export function setGameStateRef(gs) {
    gameStateRef = gs;
}

function getContext() {
    if (!gameStateRef) return {};
    return {
        arena: gameStateRef.currentArena,
        wave: gameStateRef.currentWave
    };
}

// Check if tag is enabled
function isTagEnabled(tag) {
    if (!DEBUG_CONFIG.tags) return true;
    return DEBUG_CONFIG.tags[tag] !== false;
}

// Check if logging is enabled at all
function isLoggingEnabled() {
    return DEBUG_CONFIG.level !== 'silent';
}

// Format log message: [TAG] event | context + data
function formatLog(tag, event, data) {
    const ctx = getContext();
    const merged = { ...ctx, ...data };
    const hasData = Object.keys(merged).length > 0;
    return hasData 
        ? [`[${tag}] ${event}`, merged]
        : [`[${tag}] ${event}`];
}

/**
 * Standard info log (most common)
 * @param {string} tag - Category tag (WAVE, BOSS, SPAWN, etc.)
 * @param {string} event - Event name (snake_case)
 * @param {object} data - Additional data to log
 */
export function log(tag, event, data = {}) {
    if (!isLoggingEnabled() || !isTagEnabled(tag)) return;
    const args = formatLog(tag, event, data);
    window.log.info(...args);
}

/**
 * Debug level log (more verbose)
 */
export function logDebug(tag, event, data = {}) {
    if (!isLoggingEnabled() || !isTagEnabled(tag)) return;
    const args = formatLog(tag, event, data);
    window.log.debug(...args);
}

/**
 * Warning log (always shows unless silent)
 */
export function logWarn(tag, event, data = {}) {
    if (!isLoggingEnabled() || !isTagEnabled(tag)) return;
    const args = formatLog(tag, event, data);
    window.log.warn(...args);
}

/**
 * Error log (always shows unless silent)
 */
export function logError(tag, event, data = {}) {
    if (!isLoggingEnabled()) return;
    const args = formatLog(tag, event, data);
    window.log.error(...args);
}

/**
 * Log only once per unique key (for initialization, first occurrence)
 * @param {string} key - Unique key to track (e.g., 'boss-phase-1-init')
 */
export function logOnce(key, tag, event, data = {}) {
    if (loggedOnceKeys.has(key)) return;
    loggedOnceKeys.add(key);
    log(tag, event, data);
}

/**
 * Log at most once per interval (for rate-limiting noisy events)
 * @param {string} key - Unique key to track
 * @param {number} ms - Minimum milliseconds between logs
 */
export function logThrottled(key, ms, tag, event, data = {}) {
    const now = Date.now();
    const lastTime = throttleTimestamps.get(key) || 0;
    if (now - lastTime < ms) return;
    throttleTimestamps.set(key, now);
    log(tag, event, data);
}

/**
 * Assert a condition, warn if false (for invariant checks)
 * @param {boolean} condition - Condition to check
 * @param {string} tag - Category tag
 * @param {string} message - Warning message if condition is false
 * @param {object} data - Context data
 */
export function assert(condition, tag, message, data = {}) {
    if (condition) return;
    logWarn(tag, `ASSERT_FAILED: ${message}`, data);
}

/**
 * Reset logging state (call on game restart)
 */
export function resetLogState() {
    loggedOnceKeys.clear();
    throttleTimestamps.clear();
}

/**
 * Initialize loglevel with config
 * Call this once at startup after loglevel is loaded
 */
export function initLogger() {
    if (typeof window.log === 'undefined') {
        console.warn('[DebugLog] loglevel not loaded, using console fallback');
        window.log = console;
        return;
    }
    
    // Set log level from config
    const level = DEBUG_CONFIG.level || 'info';
    window.log.setLevel(level);
    
    window.log.info('[DebugLog] Logger initialized', { level, tags: Object.keys(DEBUG_CONFIG.tags || {}).filter(t => DEBUG_CONFIG.tags[t]) });
}
