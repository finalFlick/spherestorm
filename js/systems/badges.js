// Badge System - tracks active and persistent badges
import { gameState } from '../core/gameState.js';
import { BADGES, getStatBadges, getArenaBadges, getArenaBadge } from '../config/badges.js';
import { LEADERBOARD_CONFIG } from '../config/leaderboard.js';

// Active badges for current run
let activeBadges = new Set();

// Persistent badges (saved to localStorage)
let persistentBadges = new Set();

// Initialize badge system
export function initBadges() {
    activeBadges.clear();
    loadPersistentBadges();
}

// Load persistent badges from localStorage
export function loadPersistentBadges() {
    try {
        const saved = localStorage.getItem(LEADERBOARD_CONFIG.persistentBadgesKey);
        if (saved) {
            const badges = JSON.parse(saved);
            persistentBadges = new Set(badges);
        }
    } catch (e) {
        console.warn('Could not load persistent badges:', e);
        persistentBadges = new Set();
    }
}

// Save persistent badges to localStorage
export function savePersistentBadges() {
    try {
        localStorage.setItem(
            LEADERBOARD_CONFIG.persistentBadgesKey,
            JSON.stringify([...persistentBadges])
        );
    } catch (e) {
        console.warn('Could not save persistent badges:', e);
    }
}

// Check and update stat-based badges
export function updateStatBadges() {
    const statBadges = getStatBadges();
    
    for (const badge of statBadges) {
        const statValue = gameState.stats[badge.stat];
        if (statValue >= badge.threshold) {
            activeBadges.add(badge.id);
        } else {
            activeBadges.delete(badge.id);
        }
    }
}

// Award arena badge for defeating a boss
export function awardArenaBadge(arenaNumber) {
    const badge = getArenaBadge(arenaNumber);
    if (badge) {
        persistentBadges.add(badge.id);
        activeBadges.add(badge.id);
        savePersistentBadges();
        return badge;
    }
    return null;
}

// Check if a badge is active (current run)
export function isBadgeActive(badgeId) {
    return activeBadges.has(badgeId);
}

// Check if a badge is permanently unlocked
export function isBadgePersistent(badgeId) {
    return persistentBadges.has(badgeId);
}

// Get all active badges for current run
export function getActiveBadges() {
    return [...activeBadges].map(id => BADGES[id]).filter(Boolean);
}

// Get all unlocked persistent badges
export function getPersistentBadges() {
    return [...persistentBadges].map(id => BADGES[id]).filter(Boolean);
}

// Get highest arena badge unlocked
export function getHighestArenaBadge() {
    const arenaBadges = getArenaBadges();
    let highest = null;
    let highestArena = 0;
    
    for (const badge of arenaBadges) {
        if (persistentBadges.has(badge.id) && badge.arena > highestArena) {
            highest = badge;
            highestArena = badge.arena;
        }
    }
    
    return highest;
}

// Reset active badges for new run (keeps persistent)
export function resetActiveBadges() {
    activeBadges.clear();
    // Re-add persistent badges as active
    for (const badgeId of persistentBadges) {
        activeBadges.add(badgeId);
    }
}

// Get badge display data for UI
export function getBadgeDisplayData() {
    const allBadges = Object.values(BADGES);
    
    return allBadges.map(badge => ({
        ...badge,
        active: activeBadges.has(badge.id),
        unlocked: badge.persistent ? persistentBadges.has(badge.id) : activeBadges.has(badge.id)
    }));
}

// Get only weapon/movement/defense/special badges for HUD display
export function getHudBadges() {
    return getBadgeDisplayData().filter(b => !b.persistent);
}

// Get arena mastery badges
export function getMasteryBadges() {
    return getBadgeDisplayData().filter(b => b.persistent);
}
