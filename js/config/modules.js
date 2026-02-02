// Module Configuration - Defines core upgrades and unlockable modules with mastery levels
// 
// Module System Overview:
// - Core modules: Always available in level-up pool (4 upgrades)
// - Unlockable modules: Earned through gameplay achievements
// - Mastery levels: L1 (unlock), L2, L3 (progressively stronger)
// - Mastery progression: Achieved by repeating the unlock condition

// Helper: Map unlock source to counter key (prevents hardcoded logic duplication)
export function getCounterKeyForSource(unlockSource) {
    const mapping = {
        'boss1': 'bossKills',
        'exploration': 'finds',
        'find': 'finds'
    };
    return mapping[unlockSource] || 'finds';
}

export const MODULE_CONFIG = {
    // Core modules (always available in level-up pool, no mastery)
    // IDs correspond to id properties in CORE_UPGRADES array
    core: ['damage', 'maxHealth', 'pickupRange', 'attackSpeed'],
    
    // Unlockable modules with mastery progression
    unlockable: {
        speedModule: {
            name: 'Speed Module',
            icon: '👟',
            unlockSource: 'exploration',  // Arena 1 hidden pickup
            // Mastery thresholds: number of finds required for each level
            masteryThresholds: { 
                L1: 1,   // First find unlocks
                L2: 3,   // 3 total finds
                L3: 8    // 8 total finds
            },
            // Effects scale with mastery level
            effectsByLevel: {
                1: { stat: 'moveSpeed', mult: 1.15 },   // +15%
                2: { stat: 'moveSpeed', mult: 1.25 },   // +25%
                3: { stat: 'moveSpeed', mult: 1.30 },   // +30%
            },
            // Description shown in upgrade menu
            desc: { 
                1: '+15% move speed', 
                2: '+25% move speed', 
                3: '+30% move speed' 
            }
        },
        
        dashStrike: {
            name: 'Dash Strike',
            icon: '💨',
            unlockSource: 'boss1',  // Boss 1 Phase 3 kill
            // Mastery thresholds: number of Boss 1 kills required
            masteryThresholds: { 
                L1: 1,   // First kill unlocks
                L2: 5,   // 5 total kills
                L3: 15   // 15 total kills (longer-term goal)
            },
            // Effects scale with mastery level
            // dashDistance: units traveled, cooldown: frames (60fps), damage: AoE damage
            effectsByLevel: {
                1: { dashDistance: 8, cooldown: 300, damage: 15 },   // 5s CD
                2: { dashDistance: 10, cooldown: 240, damage: 20 },  // 4s CD
                3: { dashDistance: 12, cooldown: 180, damage: 25 },  // 3s CD
            },
            // Description shown in upgrade menu
            desc: { 
                1: 'Dash attack (8 range, 5s CD)', 
                2: 'Dash attack (10 range, 4s CD)', 
                3: 'Dash attack (12 range, 3s CD)' 
            },
            // Special flag: this is an active ability, not a passive stat
            isActiveAbility: true
        }
    }
};

// Helper to get module config by ID
export function getModuleConfig(moduleId) {
    return MODULE_CONFIG.unlockable[moduleId] || null;
}

// Helper to check if a module ID is a core module
export function isCoreModule(moduleId) {
    return MODULE_CONFIG.core.includes(moduleId);
}

// Helper to get all unlockable module IDs
export function getUnlockableModuleIds() {
    return Object.keys(MODULE_CONFIG.unlockable);
}
