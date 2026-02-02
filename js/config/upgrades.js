// Core Upgrades - Always available in level-up pool (4 base upgrades)
// These are the starting upgrades before any modules are unlocked
export const CORE_UPGRADES = [
    { id: 'damage', name: 'Damage Up', icon: '⚔️', desc: '+25% damage', stat: 'damage', mult: 1.25 },
    { id: 'maxHealth', name: 'Max Health', icon: '❤️', desc: '+25 max HP', stat: 'maxHealth', add: 25 },
    { id: 'pickupRange', name: 'XP Magnet', icon: '🧲', desc: '+30% pickup range', stat: 'pickupRange', mult: 1.3 },
    { id: 'attackSpeed', name: 'Attack Speed', icon: '⚡', desc: '+25% fire rate', stat: 'attackSpeed', mult: 1.25 },
];

// Future unlockable upgrades (Arena 2+ or later modules)
// These are NOT available at game start - must be unlocked through progression
export const FUTURE_UPGRADES = [
    { id: 'multiShot', name: 'Multi Shot', icon: '🎯', desc: '+1 projectile', stat: 'projectileCount', add: 1 },
    { id: 'xpBoost', name: 'XP Boost', icon: '✨', desc: '+20% XP gain', stat: 'xpMultiplier', mult: 1.2 },
    { id: 'bulletSpeed', name: 'Bullet Speed', icon: '💨', desc: '+25% projectile speed', stat: 'projectileSpeed', mult: 1.25 }
];
