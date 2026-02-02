// Module Progress System - Persistence for module unlocks and mastery levels
import { STORAGE_PREFIX } from '../config/constants.js';
import { safeLocalStorageGet, safeLocalStorageSet } from '../utils/storage.js';
import { MODULE_CONFIG, getCounterKeyForSource } from '../config/modules.js';

const STORAGE_KEY = STORAGE_PREFIX + 'moduleProgress';

// Default state for new players
const DEFAULT_PROGRESS = {
    speedModule: { level: 0, finds: 0 },
    dashStrike: { level: 0, bossKills: 0 }
};

// Runtime cache of progress (loaded from localStorage)
let moduleProgress = null;

// Load module progress from localStorage
export function loadModuleProgress() {
    if (moduleProgress !== null) return moduleProgress;
    
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            moduleProgress = JSON.parse(saved);
            // Merge with defaults to handle new modules added in updates
            moduleProgress = { ...DEFAULT_PROGRESS, ...moduleProgress };
        } else {
            moduleProgress = { ...DEFAULT_PROGRESS };
        }
    } catch (e) {
        console.warn('Failed to load module progress:', e);
        moduleProgress = { ...DEFAULT_PROGRESS };
    }
    
    return moduleProgress;
}

// Save module progress to localStorage
export function saveModuleProgress() {
    if (!moduleProgress) return;
    
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(moduleProgress));
    } catch (e) {
        console.warn('Failed to save module progress:', e);
    }
}

// Get the mastery level (0-3) for a module
export function getModuleLevel(moduleId) {
    const progress = loadModuleProgress();
    return progress[moduleId]?.level || 0;
}

// Check if a module is unlocked (level >= 1)
export function isModuleUnlocked(moduleId) {
    return getModuleLevel(moduleId) >= 1;
}

// Get the counter value for a module (finds or bossKills)
export function getModuleCounter(moduleId, counterKey) {
    const progress = loadModuleProgress();
    return progress[moduleId]?.[counterKey] || 0;
}

// Increment a module's counter (finds++ or bossKills++)
export function incrementModuleCounter(moduleId, counterKey) {
    const progress = loadModuleProgress();
    
    if (!progress[moduleId]) {
        progress[moduleId] = { level: 0, [counterKey]: 0 };
    }
    
    progress[moduleId][counterKey] = (progress[moduleId][counterKey] || 0) + 1;
    saveModuleProgress();
    
    return progress[moduleId][counterKey];
}

// Try to level up a module based on its counter and thresholds
// Returns the new level if leveled up, or 0 if no change
export function tryLevelUpModule(moduleId) {
    const progress = loadModuleProgress();
    const config = MODULE_CONFIG.unlockable[moduleId];
    
    if (!config || !progress[moduleId]) return 0;
    
    const currentLevel = progress[moduleId].level;
    const thresholds = config.masteryThresholds;
    
    // Determine counter key based on unlock source
    const counterKey = getCounterKeyForSource(config.unlockSource);
    const counter = progress[moduleId][counterKey] || 0;
    
    // Check each threshold level
    let newLevel = 0;
    if (counter >= thresholds.L3) {
        newLevel = 3;
    } else if (counter >= thresholds.L2) {
        newLevel = 2;
    } else if (counter >= thresholds.L1) {
        newLevel = 1;
    }
    
    // Update if higher level achieved
    if (newLevel > currentLevel) {
        progress[moduleId].level = newLevel;
        saveModuleProgress();
        return newLevel;
    }
    
    return 0; // No level change
}

// Get all unlocked modules with their current levels
export function getUnlockedModules() {
    const progress = loadModuleProgress();
    const unlocked = [];
    
    for (const moduleId of Object.keys(MODULE_CONFIG.unlockable)) {
        if (progress[moduleId]?.level >= 1) {
            unlocked.push({
                id: moduleId,
                level: progress[moduleId].level,
                config: MODULE_CONFIG.unlockable[moduleId]
            });
        }
    }
    
    return unlocked;
}

// Reset all module progress (for testing/debug)
export function resetModuleProgress() {
    moduleProgress = { ...DEFAULT_PROGRESS };
    saveModuleProgress();
}

// Initialize module progress system
export function initModuleProgress() {
    loadModuleProgress();
}
