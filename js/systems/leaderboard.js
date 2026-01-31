// Local Leaderboard System
import { LEADERBOARD_CONFIG, createLeaderboardEntry } from '../config/leaderboard.js';
import { getActiveBadges } from './badges.js';

let leaderboard = [];

// Initialize leaderboard
export function initLeaderboard() {
    loadLeaderboard();
}

// Load leaderboard from localStorage
export function loadLeaderboard() {
    try {
        const saved = localStorage.getItem(LEADERBOARD_CONFIG.storageKey);
        if (saved) {
            leaderboard = JSON.parse(saved);
            // Ensure sorted
            leaderboard.sort((a, b) => b.score - a.score);
            // Trim to max entries
            if (leaderboard.length > LEADERBOARD_CONFIG.maxEntries) {
                leaderboard = leaderboard.slice(0, LEADERBOARD_CONFIG.maxEntries);
            }
        } else {
            leaderboard = [];
        }
    } catch (e) {
        console.warn('Could not load leaderboard:', e);
        leaderboard = [];
    }
}

// Save leaderboard to localStorage
export function saveLeaderboard() {
    try {
        localStorage.setItem(
            LEADERBOARD_CONFIG.storageKey,
            JSON.stringify(leaderboard)
        );
    } catch (e) {
        console.warn('Could not save leaderboard:', e);
    }
}

// Check if score qualifies for leaderboard
export function isHighScore(score) {
    if (leaderboard.length < LEADERBOARD_CONFIG.maxEntries) {
        return true;
    }
    const lowestScore = leaderboard[leaderboard.length - 1]?.score || 0;
    return score > lowestScore;
}

// Add score to leaderboard
export function addScore(name, score, arena, wave, level, timeElapsed) {
    const badges = getActiveBadges().map(b => b.id);
    const entry = createLeaderboardEntry(name, score, arena, wave, level, badges, timeElapsed);
    
    leaderboard.push(entry);
    leaderboard.sort((a, b) => b.score - a.score);
    
    // Keep only top entries
    if (leaderboard.length > LEADERBOARD_CONFIG.maxEntries) {
        leaderboard = leaderboard.slice(0, LEADERBOARD_CONFIG.maxEntries);
    }
    
    saveLeaderboard();
    
    // Return position (1-indexed)
    return leaderboard.findIndex(e => e === entry) + 1;
}

// Get leaderboard entries
export function getLeaderboard() {
    return [...leaderboard];
}

// Get rank for a score (without adding)
export function getScoreRank(score) {
    if (leaderboard.length === 0) return 1;
    
    for (let i = 0; i < leaderboard.length; i++) {
        if (score > leaderboard[i].score) {
            return i + 1;
        }
    }
    
    return leaderboard.length + 1;
}

// Clear leaderboard (for testing)
export function clearLeaderboard() {
    leaderboard = [];
    saveLeaderboard();
}

// Format time for display (seconds to M:SS)
export function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Format date for display
export function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString();
}
